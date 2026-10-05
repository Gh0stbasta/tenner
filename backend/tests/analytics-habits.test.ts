/** ANALYTICS-008: habits and consistency. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, consistency, habitDetail, habits, intervalsOf, normalizedVariance, streaks, trendOf, type AnalyticsCompletion, type HabitInput } from "../src/analytics/index.js";
import { NotFoundError } from "../src/exceptions/index.js";
import type { Tenner } from "../src/models/index.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const TODAY = "2026-10-07";
const PERIOD = { from: "2026-09-08", to: TODAY, days: 30 };
const PREVIOUS = { from: "2026-08-09", to: "2026-09-07", days: 30 };
const context = { today: TODAY, vacation: null };
const weekly = (overrides: Partial<Tenner> = {}): Tenner =>
  tennerFixture({ tennerId: "w", title: "Workout", frequencyDays: 7, createdAt: "2026-01-01T10:00:00Z", ...overrides });
const at = (dates: string[], tennerId = "w"): AnalyticsCompletion[] => dates.map((date, i) => ({ ...completionFixture({ tennerId, completionId: `${tennerId}${i}` }), date }));
const input = (completions: AnalyticsCompletion[]): HabitInput => ({ completions, skips: [], period: PERIOD, previousPeriod: PREVIOUS, context, timezone: "UTC" });

describe("streaks", () => {
  it("counts completions within frequency × 1.25 and keeps the longest run", () => {
    // 8 days ≤ 8.75 keeps the streak, 10 days breaks it.
    const dates = ["2026-08-01", "2026-08-09", "2026-08-19", "2026-08-26", "2026-09-02", "2026-09-10", "2026-10-01", "2026-10-05"];
    expect(streaks(dates, 7, TODAY)).toEqual({ current: 2, longest: 4 });
  });

  it("drops the current streak when the last completion is too long ago", () => {
    expect(streaks(["2026-09-01", "2026-09-08"], 7, TODAY)).toEqual({ current: 0, longest: 2 });
    expect(streaks([], 7, TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it("an undone completion (missing from the input) breaks the streak", () => {
    expect(streaks(["2026-09-23", "2026-09-30", "2026-10-07"], 7, TODAY).current).toBe(3);
    expect(streaks(["2026-09-23", "2026-10-07"], 7, TODAY).current).toBe(1);
  });
});

describe("consistency", () => {
  it("multiplies fulfillment with 1 − coefficient of variation", () => {
    // 4 regular completions of 4 expected: 1 × (1 − 0).
    expect(consistency(weekly(), ["2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"], 0, PERIOD, context, "UTC")).toBe(1);
    // Intervals 3 and 11: mean 7, sd 4 → CV 0.5714; 3 of 4 expected → 0.75 × 0.4286.
    expect(consistency(weekly(), ["2026-09-10", "2026-09-13", "2026-09-24"], 0, PERIOD, context, "UTC")).toBe(0.3214);
  });

  it("caps the variance at 1 and returns null with fewer than two completions", () => {
    expect(normalizedVariance([1, 1, 20])).toBe(1);
    expect(normalizedVariance([7])).toBe(0);
    expect(normalizedVariance([0, 0])).toBe(1);
    expect(consistency(weekly(), ["2026-09-10"], 0, PERIOD, context, "UTC")).toBeNull();
    expect(intervalsOf(["2026-09-01", "2026-09-08", "2026-09-10"])).toEqual([7, 2]);
  });

  it("classifies the trend with a ±0.1 threshold", () => {
    expect(trendOf(0.8, 0.6)).toBe("IMPROVING");
    expect(trendOf(0.6, 0.8)).toBe("DECLINING");
    expect(trendOf(0.75, 0.7)).toBe("STABLE");
    expect(trendOf(null, 0.7)).toBeNull();
    expect(trendOf(0.7, null)).toBeNull();
  });
});

describe("habits", () => {
  const completions = [
    ...at(["2026-08-10", "2026-08-30", "2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"]),
    ...at(["2026-09-15"], "once"),
  ];

  it("lists active Tenners with streaks, consistency and trend", () => {
    const result = habits([weekly(), weekly({ tennerId: "once", title: "Once" }), weekly({ tennerId: "off", title: "Off", active: false })], input(completions));
    expect(result.items).toEqual([
      { tennerId: "w", title: "Workout", currentStreak: 4, longestStreak: 4, consistencyScore: 1, trend: "IMPROVING" },
      { tennerId: "once", title: "Once", currentStreak: 0, longestStreak: 1, consistencyScore: null, trend: null },
    ]);
    expect(result.householdConsistency).toBe(1);
    expect(habits([], input([])).householdConsistency).toBeNull();
  });

  it("returns details for one Tenner", () => {
    expect(habitDetail(weekly(), input(completions))).toMatchObject({
      frequencyDays: 7,
      expectedCompletions: 4,
      actualCompletions: 4,
      completionDates: ["2026-09-10", "2026-09-17", "2026-09-24", "2026-10-01"],
      intervals: [7, 7, 7],
    });
  });
});

describe("AnalyticsService habits", () => {
  function service(tenner: Tenner | undefined) {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue(tenner ? [tenner] : []);
    repo.getById.mockResolvedValue(tenner);
    const listCompletions = vi.fn(async () => []);
    const listSkips = vi.fn(async () => []);
    const svc = new AnalyticsService(repo, { listCompletions, listSkips }, async () => toHouseholdResponse(undefined, "UTC"), () => new Date(`${TODAY}T10:00:00Z`));
    return { svc, listCompletions, listSkips };
  }

  it("reads the streak window and both periods in one query", async () => {
    const { svc, listCompletions, listSkips } = service(weekly());
    const result = await svc.habits("default", {});
    expect(result.period).toEqual({ from: "2026-07-10", to: TODAY });
    expect(listCompletions).toHaveBeenCalledWith("default", "2025-10-06T00:00:00Z", "2026-10-09T00:00:00Z");
    expect(listSkips).toHaveBeenCalledWith("default", "2026-04-11", TODAY);
  });

  it("returns one Tenner's details and 404 for unknown or deleted Tenners", async () => {
    await expect(service(weekly()).svc.habit("default", "w", { period: "month" })).resolves.toMatchObject({ tennerId: "w", period: { from: "2026-10-01", to: TODAY } });
    await expect(service(undefined).svc.habit("default", "x", {})).rejects.toBeInstanceOf(NotFoundError);
    await expect(service(weekly({ deletedAt: "2026-10-01T00:00:00Z" })).svc.habit("default", "w", {})).rejects.toBeInstanceOf(NotFoundError);
  });
});
