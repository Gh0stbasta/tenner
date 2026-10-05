/** ANALYTICS-001: periods, history loading and the summary. */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, loadCompletions, previousPeriod, resolvePeriod, startOfWeek, summarize, type AnalyticsCompletion } from "../src/analytics/index.js";
import { ValidationError } from "../src/exceptions/index.js";
import { DynamoDbCompletionRepository } from "../src/repositories/index.js";
import { toCompletion, toCompletionItem } from "../src/repositories/dynamodb/completion.mapper.js";
import { CompleteTennerService, toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockCompletionRepository, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const TODAY = "2026-10-07"; // a Wednesday
const period = (from: string, to: string) => ({ from, to, days: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 });
const done = (overrides: Partial<AnalyticsCompletion> = {}): AnalyticsCompletion => ({ ...completionFixture(), date: "2026-10-01", ...overrides });

describe("resolvePeriod", () => {
  it.each([
    ["week", "2026-10-05"],
    ["month", "2026-10-01"],
    ["quarter", "2026-10-01"],
    ["year", "2026-01-01"],
    ["last30", "2026-09-08"],
    ["last90", "2026-07-10"],
  ] as const)("resolves %s ending today", (shortcut, from) => {
    expect(resolvePeriod({ period: shortcut }, TODAY, "MONDAY")).toMatchObject({ from, to: TODAY });
  });

  it("defaults to last30 and respects a Sunday week start", () => {
    expect(resolvePeriod({}, TODAY, "MONDAY")).toEqual({ from: "2026-09-08", to: TODAY, days: 30 });
    expect(resolvePeriod({ period: "week" }, TODAY, "SUNDAY").from).toBe("2026-10-04");
    expect(startOfWeek("2026-10-04", "SUNDAY")).toBe("2026-10-04");
    expect(startOfWeek("2026-10-04", "MONDAY")).toBe("2026-09-28");
    expect(resolvePeriod({ period: "quarter" }, "2026-08-15", "MONDAY").from).toBe("2026-07-01");
  });

  it("accepts from/to, clamps a future end and fills a missing side", () => {
    expect(resolvePeriod({ from: "2026-09-01", to: "2026-09-30" }, TODAY, "MONDAY")).toEqual({ from: "2026-09-01", to: "2026-09-30", days: 30 });
    expect(resolvePeriod({ from: "2026-10-01", to: "2027-01-01" }, TODAY, "MONDAY").to).toBe(TODAY);
    expect(resolvePeriod({ from: "2026-10-01" }, TODAY, "MONDAY")).toMatchObject({ from: "2026-10-01", to: TODAY });
    expect(resolvePeriod({ to: "2026-09-30" }, TODAY, "MONDAY")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod({ from: TODAY, to: TODAY }, TODAY, "MONDAY").days).toBe(1);
  });

  it.each([
    [{ period: "week", from: "2026-10-01" }, "period"],
    [{ from: "2026-10-02", to: "2026-10-01" }, "from"],
    [{ from: "2026-12-01" }, "from"],
    [{ from: "2025-10-06", to: TODAY }, "from"],
  ] as const)("rejects %j", (request, field) => {
    expect(() => resolvePeriod(request, TODAY, "MONDAY")).toThrow(ValidationError);
    try {
      resolvePeriod(request, TODAY, "MONDAY");
    } catch (error) {
      expect((error as ValidationError).details?.[0]?.field).toBe(field);
    }
  });

  it("allows exactly 366 days and builds the previous period", () => {
    expect(resolvePeriod({ from: "2025-10-07", to: TODAY }, TODAY, "MONDAY").days).toBe(366);
    expect(previousPeriod(period("2026-09-01", "2026-09-30"))).toEqual({ from: "2026-08-02", to: "2026-08-31", days: 30 });
  });
});

describe("summarize", () => {
  const context = { today: TODAY, vacation: null };

  it("computes the summary", () => {
    const tenners = [
      tennerFixture({ tennerId: "a", nextDue: "2026-10-01" }), // overdue
      tennerFixture({ tennerId: "b", nextDue: TODAY }),
      tennerFixture({ tennerId: "c", nextDue: "2026-09-01", pausedAt: "2026-09-01T00:00:00Z", pausedUntil: null }), // paused, not overdue
      tennerFixture({ tennerId: "d", active: false, nextDue: "2026-09-01" }),
    ];
    const completions = [
      done({ tennerId: "a", actualMinutes: 10, date: "2026-10-01", previousNextDue: "2026-10-01" }),
      done({ tennerId: "a", actualMinutes: 15, date: "2026-10-03", previousNextDue: "2026-10-02" }),
      done({ tennerId: "x", actualMinutes: 5, date: "2026-10-04" }), // deleted Tenner, no due data
    ];
    expect(summarize(completions, tenners, period("2026-09-08", TODAY), context)).toEqual({
      period: { from: "2026-09-08", to: TODAY },
      completions: 3,
      totalActualMinutes: 30,
      activeTenners: 3,
      distinctTennersCompleted: 2,
      overdueNow: 1,
      onTimeRate: 0.5,
      onTimeSamples: 2,
    });
  });

  it("handles an empty period and missing due data", () => {
    expect(summarize([], [], period(TODAY, TODAY), context)).toMatchObject({ completions: 0, totalActualMinutes: 0, onTimeRate: null, onTimeSamples: 0 });
    expect(summarize([done()], [], period(TODAY, TODAY), context).onTimeRate).toBeNull();
  });

  it("does not count overdue Tenners paused by the vacation", () => {
    const vacation = { from: "2026-10-01", until: "2026-10-10", categories: null };
    expect(summarize([], [tennerFixture({ nextDue: "2026-10-01" })], period(TODAY, TODAY), { today: TODAY, vacation }).overdueNow).toBe(0);
  });
});

describe("loadCompletions", () => {
  it("queries one day wider and cuts on the household-local date", async () => {
    const repository = { listCompletions: vi.fn(async () => [
      completionFixture({ completionId: "late", completedAt: "2026-09-30T22:30:00Z" }), // 1 Oct 00:30 in Berlin
      completionFixture({ completionId: "before", completedAt: "2026-09-30T21:30:00Z" }), // 30 Sep 23:30 in Berlin
      completionFixture({ completionId: "after", completedAt: "2026-10-31T23:30:00Z" }), // 1 Nov in Berlin
      completionFixture({ completionId: "first", completedAt: "2026-10-01T08:00:00Z" }),
    ]) };
    const result = await loadCompletions(repository, "default", { from: "2026-10-01", to: "2026-10-31" }, "Europe/Berlin");
    expect(repository.listCompletions).toHaveBeenCalledWith("default", "2026-09-30T00:00:00Z", "2026-11-02T00:00:00Z");
    expect(result.map((c) => [c.completionId, c.date])).toEqual([["late", "2026-10-01"], ["first", "2026-10-01"]]);
  });
});

describe("DynamoDbCompletionRepository.listCompletions", () => {
  it("pages through the completedAt-index without reverted items and with a projection", async () => {
    const item = toCompletionItem({ completion: completionFixture({ previousNextDue: "2026-10-01" }) });
    const send = vi.fn().mockResolvedValueOnce({ Items: [item], LastEvaluatedKey: { k: 1 } }).mockResolvedValueOnce({ Items: [item] });
    const result = await new DynamoDbCompletionRepository({ send }, "tenner-history").listCompletions("default", "a", "b");
    expect(result).toHaveLength(2);
    expect(result[0]?.previousNextDue).toBe("2026-10-01");
    const first = (send.mock.calls[0]?.[0] as QueryCommand).input;
    expect(first).toMatchObject({ IndexName: "completedAt-index", FilterExpression: "(attribute_not_exists(#revertedAt) OR #revertedAt = :null)" });
    expect(first.ProjectionExpression).toContain("#previousNextDue");
    expect(first).not.toHaveProperty("ExclusiveStartKey");
    expect((send.mock.calls[1]?.[0] as QueryCommand).input.ExclusiveStartKey).toEqual({ k: 1 });
  });

  it("maps failures to PersistenceError", async () => {
    const repository = new DynamoDbCompletionRepository({ send: vi.fn().mockRejectedValue(new Error("down")) }, "t");
    await expect(repository.listCompletions("default", "a", "b")).rejects.toMatchObject({ code: "PERSISTENCE_ERROR" });
  });
});

describe("previousNextDue on completions", () => {
  it("is stored on new completions and read back", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tennerFixture({ nextDue: "2026-10-03" }));
    tenners.completeTenner.mockResolvedValue(undefined);
    await new CompleteTennerService(tenners, mockCompletionRepository(), () => new Date("2026-10-05T08:00:00Z"), () => "c-1", async () => "UTC").completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[1].completion.previousNextDue).toBe("2026-10-03");
    expect(toCompletion(toCompletionItem({ completion: completionFixture() }))).not.toHaveProperty("previousNextDue");
  });
});

describe("AnalyticsService.summary", () => {
  it("uses the household timezone and settings", async () => {
    const tenners = mockTennerRepository();
    tenners.list.mockResolvedValue([tennerFixture()]);
    const completions = { listCompletions: vi.fn(async () => [completionFixture({ completedAt: "2026-10-06T10:00:00Z" })]) };
    const settings = { ...toHouseholdResponse(undefined, "Europe/Berlin") };
    const service = new AnalyticsService(tenners, completions, async () => settings, () => new Date("2026-10-07T22:30:00Z"));
    const summary = await service.summary("default", { period: "week" });
    // 22:30 UTC on 7 Oct is already 8 Oct in Berlin; the week starts on Monday 5 Oct.
    expect(summary).toMatchObject({ period: { from: "2026-10-05", to: "2026-10-08" }, completions: 1, activeTenners: 1 });
    await expect(service.summary("default", { from: "2026-12-01" })).rejects.toBeInstanceOf(ValidationError);
  });
});
