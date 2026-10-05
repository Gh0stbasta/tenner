/** ANALYTICS-003: per-member metrics. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, userMetrics, type AnalyticsCompletion } from "../src/analytics/index.js";
import { SEED_MEMBERS, type HouseholdMember } from "../src/models/index.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const TODAY = "2026-10-07";
const PERIOD = { from: "2026-09-08", to: TODAY, days: 30 };
const context = { today: TODAY, vacation: null };
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: false, createdAt: "t", updatedAt: "t" };
const done = (tennerId: string, completedBy: string, minutes = 10): AnalyticsCompletion => ({ ...completionFixture({ tennerId, completedBy, actualMinutes: minutes }), date: "2026-10-01" });

const tenners = [
  tennerFixture({ tennerId: "s1", assignedTo: "STEFAN", nextDue: "2026-10-01" }), // overdue
  tennerFixture({ tennerId: "s2", assignedTo: "STEFAN", nextDue: TODAY }),
  tennerFixture({ tennerId: "j1", assignedTo: "JULIA", nextDue: "2026-10-20" }),
  tennerFixture({ tennerId: "j2", assignedTo: "JULIA", nextDue: "2026-09-01", active: false }), // inactive, not counted
  tennerFixture({ tennerId: "h1", assignedTo: "HOUSEHOLD", nextDue: "2026-10-01" }),
];

describe("userMetrics", () => {
  const result = userMetrics(
    [done("s1", "STEFAN", 10), done("j1", "STEFAN", 20), done("h1", "STEFAN", 5), done("gone", "STEFAN", 5), done("j1", "JULIA", 15)],
    tenners,
    [...SEED_MEMBERS, LENA],
    PERIOD,
    context,
  );

  it("counts completions and minutes by completedBy and assignments by current assignee", () => {
    expect(result.users[0]).toEqual({ userId: "STEFAN", displayName: "Stefan", active: true, completions: 4, actualMinutes: 40, assignedActive: 2, assignedOverdue: 1, completedForOthers: 1 });
    expect(result.users[1]).toMatchObject({ userId: "JULIA", completions: 1, actualMinutes: 15, assignedActive: 1, assignedOverdue: 0, completedForOthers: 0 });
  });

  it("includes members without activity (also deactivated ones) and reports shared Tenners separately", () => {
    expect(result.users[2]).toEqual({ userId: "LENA", displayName: "Lena", active: false, completions: 0, actualMinutes: 0, assignedActive: 0, assignedOverdue: 0, completedForOthers: 0 });
    expect(result.shared).toEqual({ assignedActive: 1, assignedOverdue: 1 });
  });

  it("excludes deleted Tenners from assigned counts", () => {
    const withDeleted = userMetrics([], [tennerFixture({ assignedTo: "JULIA", deletedAt: "2026-10-01T00:00:00Z", active: false })], SEED_MEMBERS, PERIOD, context);
    expect(withDeleted.users[1]?.assignedActive).toBe(0);
  });
});

describe("AnalyticsService.users", () => {
  it("uses the household members", async () => {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue([]);
    const service = new AnalyticsService(repo, { listCompletions: vi.fn(async () => []) }, async () => toHouseholdResponse(undefined, "UTC"), () => new Date(`${TODAY}T10:00:00Z`), async () => [LENA]);
    const result = await service.users("default", {});
    expect(result.users.map((u) => u.userId)).toEqual(["LENA"]);
    expect(result.period).toEqual({ from: "2026-09-08", to: TODAY });
  });
});
