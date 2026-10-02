import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { historyHandler, tennerHistoryHandler } from "../src/handlers/history.js";
import { HistoryService } from "../src/services/index.js";
import { decodeCursor, encodeCursor } from "../src/utils/cursor.js";
import { completionFixture, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const KEY = { tenantId: "default", historyId: "c-2", completedAt: "2026-10-01T18:30:00Z" };

function setup() {
  const completions = mockCompletionRepository();
  const tenners = mockTennerRepository();
  completions.getHistory.mockResolvedValue({
    items: [completionFixture({ completionId: "c-1", tennerId: "t-1" }), completionFixture({ completionId: "c-2", tennerId: "t-gone" })],
    lastKey: KEY,
  });
  completions.getByTenner.mockResolvedValue({ items: [completionFixture({ completionId: "c-1", tennerId: "t-1" })] });
  tenners.getTitles.mockResolvedValue(new Map([["t-1", "Vacuum Office"]]));
  tenners.getById.mockResolvedValue(tennerFixture());
  return { completions, tenners, service: new HistoryService(completions, tenners) };
}

describe("HistoryService.getHistory", () => {
  it("returns newest-first items with titles and an opaque next cursor", async () => {
    const { completions, tenners, service } = setup();
    const result = await service.getHistory("default");

    expect(completions.getHistory).toHaveBeenCalledWith("default", { limit: 20, includeReverted: false, startKey: undefined, from: undefined, to: undefined, completedBy: undefined });
    expect(tenners.getTitles).toHaveBeenCalledWith("default", ["t-1", "t-gone"]);
    expect(result.items).toEqual([
      { completionId: "c-1", tennerId: "t-1", tennerTitle: "Vacuum Office", completedBy: "STEFAN", completedAt: "2026-10-01T18:30:00Z", actualMinutes: 12, revertedAt: null },
      { completionId: "c-2", tennerId: "t-gone", tennerTitle: null, completedBy: "STEFAN", completedAt: "2026-10-01T18:30:00Z", actualMinutes: 12, revertedAt: null },
    ]);
    expect(result.nextCursor).not.toBeNull();
    expect(decodeCursor(result.nextCursor ?? "", "default")).toEqual(KEY);
  });

  it("translates date range, user filter, limit, includeUndone and cursor", async () => {
    const { completions, service } = setup();
    await service.getHistory("default", { from: "2026-09-01", to: "2026-09-30", completedBy: "JULIA", limit: 5, includeUndone: true, cursor: encodeCursor("default", KEY) });
    expect(completions.getHistory).toHaveBeenCalledWith("default", {
      limit: 5,
      includeReverted: true,
      startKey: KEY,
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-30T23:59:59Z",
      completedBy: "JULIA",
    });
  });

  it("rejects a cursor of another tenant", async () => {
    const { service } = setup();
    await expect(service.getHistory("default", { cursor: encodeCursor("other", { ...KEY, tenantId: "other" }) })).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns an empty page without title lookups and a null cursor", async () => {
    const { completions, tenners, service } = setup();
    completions.getHistory.mockResolvedValue({ items: [] });
    await expect(service.getHistory("default")).resolves.toEqual({ items: [], nextCursor: null });
    expect(tenners.getTitles).not.toHaveBeenCalled();
  });

  it("propagates repository failures", async () => {
    const { completions, service } = setup();
    completions.getHistory.mockRejectedValue(new PersistenceError());
    await expect(service.getHistory("default")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("HistoryService.getTennerHistory", () => {
  it("returns the history of one Tenner", async () => {
    const { completions, service } = setup();
    const result = await service.getTennerHistory("default", "t-1", { limit: 10 });
    expect(completions.getByTenner).toHaveBeenCalledWith("default", "t-1", { limit: 10, includeReverted: false, startKey: undefined });
    expect(result).toEqual({ items: [expect.objectContaining({ completionId: "c-1", tennerTitle: "Vacuum Office" })], nextCursor: null });
  });

  it("returns 404 for unknown Tenners", async () => {
    const { tenners, completions, service } = setup();
    tenners.getById.mockResolvedValue(undefined);
    await expect(service.getTennerHistory("default", "x")).rejects.toBeInstanceOf(NotFoundError);
    expect(completions.getByTenner).not.toHaveBeenCalled();
  });
});

describe("history handlers", () => {
  it("log counts and return 200", async () => {
    const logger = mockLogger();
    const ev = { queryStringParameters: { completedBy: "STEFAN" }, pathParameters: { tennerId: "t-1" } } as unknown as APIGatewayProxyEventV2;
    const result = { items: [], nextCursor: "abc" };
    expect((await historyHandler(ev, "default", vi.fn().mockResolvedValue(result), logger)).statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("History read", expect.objectContaining({ count: 0, hasMore: true }));
    const tennerEv = { pathParameters: { tennerId: "t-1" } } as unknown as APIGatewayProxyEventV2;
    expect((await tennerHistoryHandler(tennerEv, "default", vi.fn().mockResolvedValue({ items: [], nextCursor: null }), logger)).statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Tenner history read", { tennerId: "t-1", count: 0, hasMore: false });
  });
});
