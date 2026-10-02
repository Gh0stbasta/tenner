import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { undoCompletionHandler } from "../src/handlers/undo-completion.js";
import type { CompletionRecord } from "../src/repositories/index.js";
import { restoreSchedule, UndoCompletionService } from "../src/services/index.js";
import { completionFixture, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY, testIdentity } from "./mocks/index.js";

const NOW = new Date("2026-10-01T19:00:00.700Z");
const TS = "2026-10-01T19:00:00Z";
const latest = completionFixture({ completionId: "completion-002", completedAt: "2026-10-01T18:30:00Z" });
const previous = completionFixture({ completionId: "completion-001", completedAt: "2026-09-01T18:00:00Z" });
const loaded = tennerFixture({
  tennerId: "tenner-001",
  frequencyDays: 14,
  lastCompleted: "2026-10-01T18:30:00Z",
  nextDue: "2026-10-15",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-10-01T18:30:00Z",
});

function setup(completions = [latest, previous], tenner = loaded) {
  const tenners = mockTennerRepository();
  const history = mockCompletionRepository();
  tenners.getById.mockResolvedValue(tenner);
  tenners.undoCompletion.mockResolvedValue(undefined);
  history.getLatestActiveCompletions.mockResolvedValue(completions);
  history.findByRevertIdempotencyKey.mockResolvedValue(undefined);
  return { tenners, history, service: new UndoCompletionService(tenners, history, () => NOW) };
}

describe("UndoCompletionService", () => {
  it("reverts the latest completion and restores the previous one atomically", async () => {
    const { tenners, history, service } = setup();
    const outcome = await service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN", reason: "Completed by mistake" });

    expect(history.getLatestActiveCompletions).toHaveBeenCalledWith("default", "tenner-001", 2);
    expect(tenners.undoCompletion).toHaveBeenCalledOnce();
    const [restored, record, expected] = tenners.undoCompletion.mock.calls[0] ?? [];
    expect(expected).toBe(loaded);
    expect(restored).toEqual({ ...loaded, lastCompleted: "2026-09-01T18:00:00Z", nextDue: "2026-09-15", updatedAt: TS });
    expect(record?.completion).toEqual({ ...latest, revertedAt: TS, revertedBy: "STEFAN", revertReason: "Completed by mistake" });
    expect(outcome).toMatchObject({ restoredPrevious: true, replayed: false });
    expect(outcome.response.revertedCompletion).toEqual({
      completionId: "completion-002",
      completedBy: "STEFAN",
      completedAt: "2026-10-01T18:30:00Z",
      actualMinutes: 12,
      revertedAt: TS,
      revertedBy: "STEFAN",
      revertReason: "Completed by mistake",
    });
    expect(outcome.response.tenner).toMatchObject({ lastCompleted: "2026-09-01T18:00:00Z", nextDue: "2026-09-15", updatedAt: TS });
  });

  it("defaults revertedBy to the authenticated user and rejects another user (SECURITY-004)", async () => {
    const { tenners, service } = setup([latest]);
    await service.undoLatestCompletion(testIdentity({ userId: "JULIA" }), "tenner-001", {});
    expect(tenners.undoCompletion.mock.calls[0]?.[1].completion.revertedBy).toBe("JULIA");
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "JULIA" })).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("resets to the creation date when the first completion is reverted", async () => {
    const { tenners, service } = setup([latest]);
    const outcome = await service.undoLatestCompletion(testIdentity({ userId: "JULIA" }), "tenner-001", { revertedBy: "JULIA" });
    expect(tenners.undoCompletion.mock.calls[0]?.[0]).toMatchObject({ lastCompleted: null, nextDue: "2026-08-20", updatedBy: "JULIA" });
    expect(tenners.undoCompletion.mock.calls[0]?.[1].completion.revertReason).toBeNull();
    expect(outcome.restoredPrevious).toBe(false);
  });

  it("uses the current frequencyDays for the restored schedule", async () => {
    const { tenners, service } = setup([latest, previous], { ...loaded, frequencyDays: 30 });
    await service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" });
    expect(tenners.undoCompletion.mock.calls[0]?.[0].nextDue).toBe("2026-10-01");
  });

  it("returns NO_COMPLETION_TO_UNDO when no active completion exists", async () => {
    const { tenners, service } = setup([]);
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" })).rejects.toMatchObject({ code: "NO_COMPLETION_TO_UNDO", statusCode: 409 });
    expect(tenners.undoCompletion).not.toHaveBeenCalled();
  });

  it("returns 404 for missing Tenners", async () => {
    const { tenners, service } = setup();
    tenners.getById.mockResolvedValue(undefined);
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "x", { revertedBy: "STEFAN" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    ["inactive", { ...loaded, active: false }],
    ["soft-deleted", { ...loaded, active: false, deletedAt: "2026-10-01T00:00:00Z" }],
  ])("rejects %s Tenners with TENNER_INACTIVE", async (_name, tenner) => {
    const { service } = setup([latest], tenner);
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" })).rejects.toMatchObject({
      code: "TENNER_INACTIVE",
      message: "Completions of inactive Tenners cannot be undone.",
    });
  });

  it("propagates concurrent modification (Tenner changed or completion already reverted) and failures", async () => {
    const { tenners, service } = setup();
    tenners.undoCompletion.mockRejectedValueOnce(new ConflictError("The Tenner or completion was modified by another request.", "CONCURRENT_MODIFICATION"));
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    tenners.undoCompletion.mockRejectedValueOnce(new PersistenceError());
    await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" })).rejects.toBeInstanceOf(PersistenceError);
  });

  describe("idempotency", () => {
    async function revertedRecord(): Promise<CompletionRecord> {
      const { tenners, service } = setup();
      await service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" }, "undo-key");
      return tenners.undoCompletion.mock.calls[0]?.[1] as CompletionRecord;
    }

    it("stores the key and request hash on the reverted record", async () => {
      const record = await revertedRecord();
      expect(record.revertIdempotencyKey).toBe("undo-key");
      expect(record.revertRequestHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns the original result on retry without reverting another completion", async () => {
      const record = await revertedRecord();
      const { tenners, history, service } = setup();
      history.findByRevertIdempotencyKey.mockResolvedValue(record);
      const outcome = await service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" }, "undo-key");
      expect(outcome.replayed).toBe(true);
      expect(outcome.response.revertedCompletion.completionId).toBe("completion-002");
      expect(history.getLatestActiveCompletions).not.toHaveBeenCalled();
      expect(tenners.undoCompletion).not.toHaveBeenCalled();
    });

    it("rejects key reuse with a different request", async () => {
      const record = await revertedRecord();
      const { history, service } = setup();
      history.findByRevertIdempotencyKey.mockResolvedValue(record);
      await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { reason: "Different reason" }, "undo-key")).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    });

    it("resolves a concurrent duplicate to the original result", async () => {
      const record = await revertedRecord();
      const { tenners, history, service } = setup();
      history.findByRevertIdempotencyKey.mockResolvedValueOnce(undefined).mockResolvedValueOnce(record);
      tenners.undoCompletion.mockRejectedValue(new ConflictError("m", "CONCURRENT_MODIFICATION"));
      await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" }, "undo-key")).resolves.toMatchObject({ replayed: true });
    });

    it("rethrows the conflict when no replay is found", async () => {
      const { tenners, service } = setup();
      tenners.undoCompletion.mockRejectedValue(new ConflictError("m", "CONCURRENT_MODIFICATION"));
      await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" }, "undo-key")).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    });

    it("returns 404 on replay if the Tenner disappeared", async () => {
      const record = await revertedRecord();
      const { tenners, history, service } = setup();
      history.findByRevertIdempotencyKey.mockResolvedValue(record);
      tenners.getById.mockResolvedValue(undefined);
      await expect(service.undoLatestCompletion(TEST_IDENTITY, "tenner-001", { revertedBy: "STEFAN" }, "undo-key")).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("restoreSchedule", () => {
  it("falls back to today when createdAt is not a valid date", () => {
    expect(restoreSchedule({ ...loaded, createdAt: "unknown" }, undefined, NOW, TS).nextDue).toBe("2026-10-01");
  });

  it("allows a restored nextDue in the past (overdue again)", () => {
    expect(restoreSchedule(loaded, previous, NOW, TS).nextDue).toBe("2026-09-15");
  });
});

describe("undoCompletionHandler", () => {
  const event = (payload: unknown): APIGatewayProxyEventV2 =>
    ({ body: JSON.stringify(payload), headers: {}, pathParameters: { tennerId: "tenner-001" } }) as unknown as APIGatewayProxyEventV2;
  const outcome = {
    response: { tenner: { nextDue: "2026-09-15" }, revertedCompletion: { completionId: "completion-002", revertedBy: "STEFAN" } },
    restoredPrevious: true,
    replayed: false,
  };

  it("returns 200 and logs the structured success event", async () => {
    const logger = mockLogger();
    let t = 0;
    const response = await undoCompletionHandler(event({ revertedBy: "STEFAN" }), TEST_IDENTITY, vi.fn().mockResolvedValue(outcome), logger, () => (t += 3));
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Undo completion requested", { tennerId: "tenner-001", revertedBy: "STEFAN", idempotencyKey: false });
    expect(logger.info).toHaveBeenCalledWith(
      "Undo completion succeeded",
      expect.objectContaining({ event: "UndoSucceeded", completionId: "completion-002", restoredPrevious: true, restoredNextDue: "2026-09-15", durationMs: 3 }),
    );
  });

  it.each([
    ["NO_COMPLETION_TO_UNDO", new ConflictError("m", "NO_COMPLETION_TO_UNDO"), "UndoNoCompletion"],
    ["CONCURRENT_MODIFICATION", new ConflictError("m", "CONCURRENT_MODIFICATION"), "UndoConflict"],
    ["TENNER_INACTIVE", new ConflictError("m", "TENNER_INACTIVE"), "UndoFailed"],
    ["INTERNAL_ERROR", new Error("x"), "UndoFailed"],
  ])("logs %s failures as metric events and rethrows", async (code, error, eventName) => {
    const logger = mockLogger();
    await expect(undoCompletionHandler(event({ revertedBy: "STEFAN" }), TEST_IDENTITY, vi.fn().mockRejectedValue(error), logger)).rejects.toBe(error);
    expect(logger.warn).toHaveBeenCalledWith("Undo completion failed", expect.objectContaining({ event: eventName, errorCode: code }));
  });

  it.each([
    ["invalid reverted user", { revertedBy: "BOB" }],
    ["reason too long", { revertedBy: "STEFAN", reason: "x".repeat(251) }],
    ["whitespace-only reason", { revertedBy: "STEFAN", reason: "   " }],
    ["unknown field", { revertedBy: "STEFAN", completionId: "c-1" }],
  ])("rejects %s", async (_name, payload) => {
    const undo = vi.fn();
    await expect(undoCompletionHandler(event(payload), TEST_IDENTITY, undo, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(undo).not.toHaveBeenCalled();
  });

  it("accepts a reason of exactly 250 characters", async () => {
    const undo = vi.fn().mockResolvedValue(outcome);
    await undoCompletionHandler(event({ revertedBy: "STEFAN", reason: "x".repeat(250) }), TEST_IDENTITY, undo, mockLogger());
    expect(undo).toHaveBeenCalledOnce();
  });
});
