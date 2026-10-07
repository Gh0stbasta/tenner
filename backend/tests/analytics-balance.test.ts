/** ANALYTICS-007: household balance. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, balance, projectedWeeklyMinutes, type AnalyticsCompletion } from "../src/analytics/index.js";
import { SEED_CATEGORIES, SEED_MEMBERS, type HouseholdMember } from "../src/models/index.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const PERIOD = { from: "2026-09-08", to: "2026-10-07", days: 30 };
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, canSignIn: true, createdAt: "t", updatedAt: "t" };
const done = (completedBy: string, minutes: number, tennerId = "h"): AnalyticsCompletion => ({ ...completionFixture({ completedBy, actualMinutes: minutes, tennerId }), date: "2026-10-01" });
// 10 minutes every 7 days = 10 weekly minutes each.
const weekly = (tennerId: string, assignedTo: string, category = "HOUSEHOLD") => tennerFixture({ tennerId, assignedTo, category, estimatedMinutes: 10, frequencyDays: 7 });

describe("balance", () => {
  it("is fully balanced for an even distribution", () => {
    const result = balance([done("STEFAN", 30), done("JULIA", 30)], [weekly("h", "STEFAN"), weekly("j", "JULIA")], SEED_MEMBERS, SEED_CATEGORIES, PERIOD);
    expect(result.byUser).toEqual([
      { userId: "STEFAN", displayName: "Stefan", shareOfMinutes: 0.5, shareOfAssignedLoad: 0.5 },
      { userId: "JULIA", displayName: "Julia", shareOfMinutes: 0.5, shareOfAssignedLoad: 0.5 },
    ]);
    expect(result.balanceIndex).toBe(1);
  });

  it("measures an uneven distribution and category shares", () => {
    const tenners = [weekly("h", "STEFAN"), weekly("f", "JULIA", "FITNESS"), weekly("f2", "JULIA", "FITNESS"), weekly("s", "HOUSEHOLD")];
    const result = balance([done("STEFAN", 30, "h"), done("JULIA", 70, "h"), done("JULIA", 20, "f")], tenners, SEED_MEMBERS, SEED_CATEGORIES, PERIOD);
    expect(result.byUser.map((u) => [u.shareOfMinutes, u.shareOfAssignedLoad])).toEqual([
      [0.25, 0.375], // load: 10 own + 5 shared of 40 weekly minutes
      [0.75, 0.625],
    ]);
    expect(result.balanceIndex).toBe(0.5);
    expect(result.byCategory.find((c) => c.category === "HOUSEHOLD")?.shares).toEqual({ STEFAN: 0.3, JULIA: 0.7 });
    expect(result.byCategory.find((c) => c.category === "FITNESS")?.shares).toEqual({ STEFAN: 0, JULIA: 1 });
    expect(result.byCategory.find((c) => c.category === "FAMILY")?.shares).toBeNull();
  });

  it("returns nulls without activity", () => {
    const result = balance([], [], SEED_MEMBERS, SEED_CATEGORIES, PERIOD);
    expect(result.byUser.every((u) => u.shareOfMinutes === null && u.shareOfAssignedLoad === null)).toBe(true);
    expect(result.balanceIndex).toBeNull();
  });

  it("works for one member and for three or more", () => {
    const single = balance([done("STEFAN", 10)], [weekly("h", "STEFAN")], [SEED_MEMBERS[0] as HouseholdMember], SEED_CATEGORIES, PERIOD);
    expect(single.byUser).toEqual([{ userId: "STEFAN", displayName: "Stefan", shareOfMinutes: 1, shareOfAssignedLoad: 1 }]);
    expect(single.balanceIndex).toBe(1);
    const three = balance([done("STEFAN", 20), done("JULIA", 20), done("LENA", 60)], [], [...SEED_MEMBERS, LENA], SEED_CATEGORIES, PERIOD);
    expect(three.byUser.map((u) => u.shareOfMinutes)).toEqual([0.2, 0.2, 0.6]);
    expect(three.balanceIndex).toBe(0.6);
  });

  it("keeps deactivated members only when they have minutes", () => {
    const inactive = { ...LENA, active: false };
    expect(balance([], [], [...SEED_MEMBERS, inactive], SEED_CATEGORIES, PERIOD).byUser.map((u) => u.userId)).toEqual(["STEFAN", "JULIA"]);
    expect(balance([done("LENA", 10)], [], [...SEED_MEMBERS, inactive], SEED_CATEGORIES, PERIOD).byUser.map((u) => u.userId)).toEqual(["STEFAN", "JULIA", "LENA"]);
  });

  it("projects weekly minutes from the frequency", () => {
    expect(projectedWeeklyMinutes(tennerFixture({ estimatedMinutes: 30, frequencyDays: 14 }))).toBe(15);
  });
});

describe("AnalyticsService.balance", () => {
  it("loads members and categories", async () => {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue([]);
    const service = new AnalyticsService(repo, { listCompletions: vi.fn(async () => []), listSkips: vi.fn(async () => []) }, async () => toHouseholdResponse(undefined, "UTC"), () => new Date("2026-10-07T10:00:00Z"), async () => [LENA]);
    const result = await service.balance("default", { period: "last30" });
    expect(result.byUser.map((u) => u.userId)).toEqual(["LENA"]);
    expect(result.byCategory).toHaveLength(SEED_CATEGORIES.length);
  });
});
