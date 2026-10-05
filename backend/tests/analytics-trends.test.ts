/** ANALYTICS-002: completion trends. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, bucketStart, filterCompletions, trends, type AnalyticsCompletion } from "../src/analytics/index.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const p = (from: string, to: string, days: number) => ({ from, to, days });
const done = (date: string, minutes = 10, tennerId = "t-1"): AnalyticsCompletion => ({ ...completionFixture({ tennerId, actualMinutes: minutes }), date });

describe("trends", () => {
  it("builds zero-filled daily buckets", () => {
    const result = trends([done("2026-10-01"), done("2026-10-03", 5), done("2026-10-03", 7)], [], p("2026-10-01", "2026-10-04", 4), p("2026-09-27", "2026-09-30", 4), "day", "MONDAY");
    expect(result.buckets).toEqual([
      { start: "2026-10-01", completions: 1, actualMinutes: 10 },
      { start: "2026-10-02", completions: 0, actualMinutes: 0 },
      { start: "2026-10-03", completions: 2, actualMinutes: 12 },
      { start: "2026-10-04", completions: 0, actualMinutes: 0 },
    ]);
  });

  it("uses ISO weeks (Monday) or Sunday weeks and calendar months", () => {
    const period = p("2026-09-02", "2026-10-07", 36);
    const weekly = trends([done("2026-09-06"), done("2026-09-07")], [], period, p("2026-07-28", "2026-09-01", 36), "week", "MONDAY");
    expect(weekly.buckets.map((b) => b.start)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(weekly.buckets[0]?.completions).toBe(1);
    expect(weekly.buckets[1]?.completions).toBe(1);
    expect(bucketStart("2026-09-06", "week", "SUNDAY")).toBe("2026-09-06");
    const monthly = trends([done("2026-09-30"), done("2026-10-01")], [], period, period, "month", "MONDAY");
    expect(monthly.buckets).toEqual([
      { start: "2026-09-01", completions: 1, actualMinutes: 10 },
      { start: "2026-10-01", completions: 1, actualMinutes: 10 },
    ]);
  });

  it("compares with the previous period and avoids division by zero", () => {
    const period = p("2026-10-01", "2026-10-02", 2);
    const prev = p("2026-09-29", "2026-09-30", 2);
    expect(trends([done("2026-10-01"), done("2026-10-01"), done("2026-10-02")], [done("2026-09-29"), done("2026-09-30")], period, prev, "day", "MONDAY").comparison).toEqual({
      previousPeriod: { from: "2026-09-29", to: "2026-09-30" },
      previousPeriodCompletions: 2,
      changePercent: 50,
    });
    expect(trends([done("2026-10-01")], [], period, prev, "day", "MONDAY").comparison.changePercent).toBeNull();
    expect(trends([], [done("2026-09-29"), done("2026-09-29"), done("2026-09-29")], period, prev, "day", "MONDAY").comparison.changePercent).toBe(-100);
  });
});

describe("filterCompletions", () => {
  const tenners = new Map([
    ["a", tennerFixture({ tennerId: "a", assignedTo: "JULIA", category: "HOME" })],
    ["b", tennerFixture({ tennerId: "b", assignedTo: "STEFAN", category: "HOME" })],
  ]);
  const all = [done("2026-10-01", 10, "a"), done("2026-10-01", 10, "b"), done("2026-10-01", 10, "gone")];

  it("filters by the Tenner's assignee and category; unfiltered keeps unknown Tenners", () => {
    expect(filterCompletions(all, tenners, {})).toHaveLength(3);
    expect(filterCompletions(all, tenners, { assignedTo: "JULIA" }).map((c) => c.tennerId)).toEqual(["a"]);
    expect(filterCompletions(all, tenners, { category: "HOME" }).map((c) => c.tennerId)).toEqual(["a", "b"]);
    expect(filterCompletions(all, tenners, { assignedTo: "STEFAN", category: "FITNESS" })).toEqual([]);
  });
});

describe("AnalyticsService.trends", () => {
  it("loads both periods in one query and buckets in the household timezone", async () => {
    const tenners = mockTennerRepository();
    tenners.list.mockResolvedValue([tennerFixture({ tennerId: "t-1", assignedTo: "STEFAN" })]);
    const listCompletions = vi.fn(async () => [
      completionFixture({ tennerId: "t-1", completedAt: "2026-10-04T23:30:00Z" }), // Monday 5 Oct in Berlin
      completionFixture({ tennerId: "t-1", completedAt: "2026-09-20T10:00:00Z" }), // previous period
    ]);
    const service = new AnalyticsService(tenners, { listCompletions, listSkips: vi.fn(async () => []) }, async () => toHouseholdResponse(undefined, "Europe/Berlin"), () => new Date("2026-10-07T10:00:00Z"));
    const result = await service.trends("default", { from: "2026-09-28", to: "2026-10-07", assignedTo: "STEFAN" });
    expect(listCompletions).toHaveBeenCalledWith("default", "2026-09-17T00:00:00Z", "2026-10-09T00:00:00Z");
    expect(tenners.list).toHaveBeenCalledWith("default", { includeDeleted: true });
    expect(result.buckets).toEqual([
      { start: "2026-09-28", completions: 0, actualMinutes: 0 },
      { start: "2026-10-05", completions: 1, actualMinutes: 12 },
    ]);
    expect(result.comparison).toEqual({ previousPeriod: { from: "2026-09-18", to: "2026-09-27" }, previousPeriodCompletions: 1, changePercent: 0 });
  });
});
