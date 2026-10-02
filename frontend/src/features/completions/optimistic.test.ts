import { describe, expect, it } from "vitest";
import { dashboard } from "../../tests/fixtures";
import { removeFromDashboard } from "./optimistic";

describe("removeFromDashboard", () => {
  it("removes a due-today Tenner and adjusts summary and groups", () => {
    const next = removeFromDashboard(dashboard(), "t-1");
    expect(next.dueToday).toEqual([]);
    expect(next.summary).toMatchObject({
      dueTodayCount: 0,
      dueTodayMinutes: 0,
      overdueCount: 1,
      totalActionableCount: 1,
      totalActionableMinutes: 15,
    });
    expect(next.byUser).toEqual({ JULIA: { count: 1, estimatedMinutes: 15 } });
    expect(next.byCategory).toEqual({ HOME: { count: 1, estimatedMinutes: 15 } });
  });

  it("removes an overdue Tenner and decrements a larger group", () => {
    const base = dashboard({ byUser: { JULIA: { count: 3, estimatedMinutes: 40 } }, byCategory: {} });
    const next = removeFromDashboard(base, "t-2");
    expect(next.overdue).toEqual([]);
    expect(next.summary).toMatchObject({
      overdueCount: 0,
      overdueMinutes: 0,
      dueTodayCount: 1,
      totalActionableCount: 1,
    });
    expect(next.byUser).toEqual({ JULIA: { count: 2, estimatedMinutes: 25 } });
  });

  it("returns the dashboard unchanged for unknown or upcoming Tenners", () => {
    const base = dashboard();
    expect(removeFromDashboard(base, "missing")).toBe(base);
    expect(removeFromDashboard(base, "t-3")).toBe(base);
  });
});
