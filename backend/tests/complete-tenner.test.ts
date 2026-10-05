import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { completeTennerHandler } from "../src/handlers/complete-tenner.js";
import type { CompletionRecord } from "../src/repositories/index.js";
import { CompleteTennerService, nextDueAfter } from "../src/services/index.js";
import { uuidV5 } from "../src/utils/uuid.js";
import { mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY, testIdentity } from "./mocks/index.js";

const NOW = new Date("2026-10-01T18:30:00.400Z");
const NEW_ID = "8b4772cd-781d-49b8-8cd0-4e68d5267d32";

function setup(tenner = tennerFixture({ tennerId: "tenner-001", nextDue: "2026-10-01", updatedAt: "2026-09-17T10:00:00Z" })) {
  const tenners = mockTennerRepository();
  const completions = mockCompletionRepository();
  tenners.getById.mockResolvedValue(tenner);
  tenners.completeTenner.mockResolvedValue(undefined);
  completions.getById.mockResolvedValue(undefined);
  return { tenners, completions, tenner, service: new CompleteTennerService(tenners, completions, () => NOW, () => NEW_ID, async () => "UTC") };
}

describe("CompleteTennerService", () => {
  it("completes a Tenner: history record + schedule update in one repository call", async () => {
    const { tenners, tenner, service } = setup();
    const { response, replayed } = await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN", actualMinutes: 12 });

    expect(replayed).toBe(false);
    expect(tenners.completeTenner).toHaveBeenCalledOnce();
    const [updated, record, expected] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(expected).toBe(tenner);
    expect(updated).toEqual({ ...tenner, lastCompleted: "2026-10-01T18:30:00Z", nextDue: "2026-10-15", updatedAt: "2026-10-01T18:30:00Z", updatedBy: "STEFAN" });
    expect(record?.completion).toEqual({
      tenantId: "default",
      completionId: NEW_ID,
      tennerId: "tenner-001",
      completedBy: "STEFAN",
      recordedBy: "STEFAN",
      completedAt: "2026-10-01T18:30:00Z",
      actualMinutes: 12,
      revertedAt: null,
      revertedBy: null,
      revertReason: null,
    });
    expect(record?.idempotencyKey).toBeUndefined();
    expect(response.completion.completionId).toBe(NEW_ID);
    expect(response.tenner.nextDue).toBe("2026-10-15");
  });

  it("defaults completedBy to the authenticated user and records the acting user (SECURITY-004)", async () => {
    const { tenners, service } = setup();
    const { response } = await service.completeTenner(testIdentity({ userId: "JULIA" }), "tenner-001", {});
    const [updated, record] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(record?.completion).toMatchObject({ completedBy: "JULIA", recordedBy: "JULIA" });
    expect(updated?.updatedBy).toBe("JULIA");
    expect(response.completion.completedBy).toBe("JULIA");
  });

  it("allows completing for another household member and stores recordedBy separately", async () => {
    const { tenners, service } = setup();
    await service.completeTenner(testIdentity({ userId: "JULIA" }), "tenner-001", { completedBy: "STEFAN" });
    const [updated, record] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(record?.completion).toMatchObject({ completedBy: "STEFAN", recordedBy: "JULIA" });
    expect(updated?.updatedBy).toBe("JULIA");
  });

  it("treats an omitted completedBy like the authenticated user for idempotency replays", async () => {
    const first = setup();
    await first.service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, "same-key");
    const stored = first.tenners.completeTenner.mock.calls[0]?.[1];
    const { completions, service } = setup();
    completions.getById.mockResolvedValue(stored);
    await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", {}, "same-key")).resolves.toMatchObject({ replayed: true });
  });

  it("defaults actualMinutes to estimatedMinutes and completedAt to now", async () => {
    const { tenners, service } = setup();
    await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "JULIA" });
    expect(tenners.completeTenner.mock.calls[0]?.[1].completion).toMatchObject({ actualMinutes: 10, completedAt: "2026-10-01T18:30:00Z", completedBy: "JULIA" });
  });

  it("uses an explicit completedAt for history and next due date", async () => {
    const { tenners, service } = setup();
    await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN", completedAt: "2026-09-30T22:15:00.000Z" });
    const [updated, record] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(record?.completion.completedAt).toBe("2026-09-30T22:15:00Z");
    expect(updated?.lastCompleted).toBe("2026-09-30T22:15:00Z");
    expect(updated?.nextDue).toBe("2026-10-14");
  });

  it("rejects future completion timestamps (beyond 60s clock skew)", async () => {
    const { tenners, service } = setup();
    await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN", completedAt: "2026-10-01T18:32:00Z" })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN", completedAt: "2026-10-01T18:30:30Z" })).resolves.toBeDefined();
    expect(tenners.completeTenner).toHaveBeenCalledOnce();
  });

  it("rejects completion timestamps before the last completion", async () => {
    const { service } = setup(tennerFixture({ lastCompleted: "2026-09-30T08:00:00Z" }));
    await expect(service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN", completedAt: "2026-09-29T08:00:00Z" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("calculates from the completion date for early completion", async () => {
    const { tenners, service } = setup(tennerFixture({ nextDue: "2026-10-10", frequencyDays: 14 }));
    await service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN", completedAt: "2026-10-01T09:00:00Z" });
    expect(tenners.completeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-15");
  });

  it("calculates from the completion date for overdue completion (not from the old due date)", async () => {
    const { tenners, service } = setup(tennerFixture({ nextDue: "2026-09-01", frequencyDays: 14 }));
    await service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN" });
    expect(tenners.completeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-15");
  });

  it("keeps monthly Tenners on their calendar day and clamps month ends (SCHEDULING-001)", async () => {
    const monthly = tennerFixture({ nextDue: "2026-01-31", frequencyDays: 30, frequencyUnit: "MONTH", frequencyInterval: 1 });
    const { tenners, service } = setup(monthly);
    await service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN", completedAt: "2026-01-31T09:00:00Z" });
    expect(tenners.completeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-02-28");
  });

  it("returns 404 for missing Tenners", async () => {
    const { tenners, service } = setup();
    tenners.getById.mockResolvedValue(undefined);
    await expect(service.completeTenner(TEST_IDENTITY, "x", { completedBy: "STEFAN" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    ["inactive", tennerFixture({ active: false })],
    ["soft-deleted", tennerFixture({ active: false, deletedAt: "2026-09-01T00:00:00Z" })],
  ])("rejects %s Tenners with TENNER_INACTIVE", async (_name, tenner) => {
    const { tenners, service } = setup(tenner);
    await expect(service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN" })).rejects.toMatchObject({ code: "TENNER_INACTIVE", statusCode: 409 });
    expect(tenners.completeTenner).not.toHaveBeenCalled();
  });

  it("propagates concurrent modification and transaction failures", async () => {
    const { tenners, service } = setup();
    tenners.completeTenner.mockRejectedValueOnce(new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION"));
    await expect(service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN" })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    tenners.completeTenner.mockRejectedValueOnce(new PersistenceError());
    await expect(service.completeTenner(TEST_IDENTITY, "t", { completedBy: "STEFAN" })).rejects.toBeInstanceOf(PersistenceError);
  });

  describe("idempotency", () => {
    const KEY = "retry-key-1";
    const ID = uuidV5(`default:${KEY}`);

    it("derives a deterministic completion id and stores key and request hash", async () => {
      const { tenners, completions, service } = setup();
      await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY);
      expect(completions.getById).toHaveBeenCalledWith("default", ID);
      const record = tenners.completeTenner.mock.calls[0]?.[1];
      expect(record?.completion.completionId).toBe(ID);
      expect(record?.idempotencyKey).toBe(KEY);
      expect(record?.requestHash).toMatch(/^[0-9a-f]{64}$/);
    });

    async function storedRecord(): Promise<CompletionRecord> {
      const { tenners, service } = setup();
      await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY);
      return tenners.completeTenner.mock.calls[0]?.[1] as CompletionRecord;
    }

    it("returns the original result on retry without writing again", async () => {
      const stored = await storedRecord();
      const { tenners, completions, service } = setup();
      completions.getById.mockResolvedValue(stored);
      const { response, replayed } = await service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY);
      expect(replayed).toBe(true);
      expect(response.completion).toEqual({
        completionId: ID,
        tennerId: "tenner-001",
        completedBy: "STEFAN",
        completedAt: stored.completion.completedAt,
        actualMinutes: stored.completion.actualMinutes,
      });
      expect(tenners.completeTenner).not.toHaveBeenCalled();
    });

    it.each([
      ["a different Tenner", "tenner-002", { completedBy: "STEFAN" as const }],
      ["a different payload", "tenner-001", { completedBy: "JULIA" as const }],
    ])("rejects key reuse for %s with IDEMPOTENCY_KEY_REUSED", async (_name, tennerId, request) => {
      const stored = await storedRecord();
      const { completions, service } = setup();
      completions.getById.mockResolvedValue(stored);
      await expect(service.completeTenner(TEST_IDENTITY, tennerId, request, KEY)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", statusCode: 409 });
    });

    it("resolves a concurrent duplicate (transaction says DUPLICATE_COMPLETION) to the original result", async () => {
      const stored = await storedRecord();
      const { tenners, completions, service } = setup();
      completions.getById.mockResolvedValueOnce(undefined).mockResolvedValueOnce(stored);
      tenners.completeTenner.mockRejectedValue(new ConflictError("A completion with this ID already exists.", "DUPLICATE_COMPLETION"));
      await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY)).resolves.toMatchObject({ replayed: true });
    });

    it("rethrows DUPLICATE_COMPLETION when the record cannot be found afterwards", async () => {
      const { tenners, service } = setup();
      tenners.completeTenner.mockRejectedValue(new ConflictError("dup", "DUPLICATE_COMPLETION"));
      await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY)).rejects.toMatchObject({ code: "DUPLICATE_COMPLETION" });
    });

    it("returns 404 on replay if the Tenner disappeared", async () => {
      const stored = await storedRecord();
      const { tenners, completions, service } = setup();
      completions.getById.mockResolvedValue(stored);
      tenners.getById.mockResolvedValue(undefined);
      await expect(service.completeTenner(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN" }, KEY)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

const days = (frequencyInterval: number) => ({ frequencyUnit: "DAY", frequencyInterval }) as const;

describe("nextDueAfter", () => {
  it("adds frequencyDays to the completion date in the given timezone", () => {
    expect(nextDueAfter("2026-10-01T18:30:00Z", days(14), "UTC")).toBe("2026-10-15");
    expect(nextDueAfter("2026-10-01T23:59:59Z", days(1), "UTC")).toBe("2026-10-02");
  });

  // SCHEDULING-008: Europe/Berlin is UTC+2 in summer, UTC+1 in winter.
  it("completion just after local midnight counts for the new local day", () => {
    // 2 Oct 00:30 in Berlin = 1 Oct 22:30 UTC
    expect(nextDueAfter("2026-10-01T22:30:00Z", days(14), "Europe/Berlin")).toBe("2026-10-16");
    expect(nextDueAfter("2026-10-01T22:30:00Z", days(14), "UTC")).toBe("2026-10-15");
  });

  it("completion just before local midnight counts for the old local day", () => {
    // 1 Oct 23:59 in Berlin = 1 Oct 21:59 UTC
    expect(nextDueAfter("2026-10-01T21:59:00Z", days(1), "Europe/Berlin")).toBe("2026-10-02");
  });

  it("handles the DST start (last Sunday in March) and end (last Sunday in October)", () => {
    // 29 Mar 2026: 02:00 CET -> 03:00 CEST. 00:30 local = 28 Mar 23:30 UTC; 03:30 local = 01:30 UTC
    expect(nextDueAfter("2026-03-28T23:30:00Z", days(1), "Europe/Berlin")).toBe("2026-03-30");
    expect(nextDueAfter("2026-03-29T01:30:00Z", days(7), "Europe/Berlin")).toBe("2026-04-05");
    // 25 Oct 2026: 03:00 CEST -> 02:00 CET. 00:30 local = 24 Oct 22:30 UTC; 23:30 local = 25 Oct 22:30 UTC
    expect(nextDueAfter("2026-10-24T22:30:00Z", days(1), "Europe/Berlin")).toBe("2026-10-26");
    expect(nextDueAfter("2026-10-25T22:30:00Z", days(1), "Europe/Berlin")).toBe("2026-10-26");
  });

  it("supports non-default timezones", () => {
    // 1 Oct 20:00 in New York = 2 Oct 00:00 UTC
    expect(nextDueAfter("2026-10-02T00:00:00Z", days(1), "America/New_York")).toBe("2026-10-02");
    expect(nextDueAfter("2026-10-01T15:30:00Z", days(1), "Asia/Tokyo")).toBe("2026-10-03");
  });
});

describe("completeTennerHandler", () => {
  const event = (payload: unknown, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
    ({ body: JSON.stringify(payload), headers, pathParameters: { tennerId: "tenner-001" } }) as unknown as APIGatewayProxyEventV2;
  const result = {
    response: {
      tenner: { nextDue: "2026-10-15" },
      completion: { completionId: NEW_ID, completedBy: "STEFAN", actualMinutes: 12 },
    },
    replayed: false,
  };
  const clock = (() => {
    let t = 1000;
    return () => (t += 5);
  })();

  it("returns 200 and logs request and success with structured metric fields", async () => {
    const logger = mockLogger();
    const complete = vi.fn().mockResolvedValue(result);
    const response = await completeTennerHandler(event({ completedBy: "STEFAN", actualMinutes: 12 }), TEST_IDENTITY, complete, logger, clock);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: result.response });
    expect(complete).toHaveBeenCalledWith(TEST_IDENTITY, "tenner-001", { completedBy: "STEFAN", actualMinutes: 12 }, undefined);
    expect(logger.info).toHaveBeenCalledWith("Tenner completion requested", { tennerId: "tenner-001", completedBy: "STEFAN", recordedBy: "STEFAN", idempotencyKey: false });
    expect(logger.info).toHaveBeenCalledWith("Tenner completion succeeded", expect.objectContaining({ event: "CompletionSucceeded", completionId: NEW_ID, nextDue: "2026-10-15", durationMs: 5 }));
  });

  it.each([
    ["CONCURRENT_MODIFICATION", new ConflictError("m", "CONCURRENT_MODIFICATION"), "CompletionConflict"],
    ["TENNER_INACTIVE", new ConflictError("m", "TENNER_INACTIVE"), "CompletionFailed"],
    ["INTERNAL_ERROR", new Error("x"), "CompletionFailed"],
  ])("logs %s failures and rethrows", async (code, error, eventName) => {
    const logger = mockLogger();
    await expect(completeTennerHandler(event({ completedBy: "STEFAN" }), TEST_IDENTITY, vi.fn().mockRejectedValue(error), logger, clock)).rejects.toBe(error);
    expect(logger.warn).toHaveBeenCalledWith("Tenner completion failed", expect.objectContaining({ event: eventName, errorCode: code }));
  });

  it.each([
    ["invalid completed user", { completedBy: "bob" }],
    ["invalid actual minutes", { completedBy: "STEFAN", actualMinutes: 0 }],
    ["timestamp with offset", { completedBy: "STEFAN", completedAt: "2026-10-01T20:30:00+02:00" }],
  ])("rejects %s", async (_name, payload) => {
    const complete = vi.fn();
    await expect(completeTennerHandler(event(payload), TEST_IDENTITY, complete, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(complete).not.toHaveBeenCalled();
  });
});
