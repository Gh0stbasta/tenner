/** ANALYTICS-004: category metrics. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, categoryMetrics, type AnalyticsCompletion } from "../src/analytics/index.js";
import { SEED_CATEGORIES, type HouseholdCategory } from "../src/models/index.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const TODAY = "2026-10-07";
const PERIOD = { from: "2026-09-08", to: TODAY, days: 30 };
const context = { today: TODAY, vacation: null };
const done = (tennerId: string, minutes: number): AnalyticsCompletion => ({ ...completionFixture({ tennerId, actualMinutes: minutes }), date: "2026-10-01" });
const byId = (list: { category: string }[], id: string) => list.find((entry) => entry.category === id);

describe("categoryMetrics", () => {
  const tenners = [
    tennerFixture({ tennerId: "f1", category: "FITNESS", nextDue: "2026-10-01" }), // overdue
    tennerFixture({ tennerId: "f2", category: "FITNESS", nextDue: "2026-10-20" }),
    tennerFixture({ tennerId: "h1", category: "HOUSEHOLD", nextDue: "2026-10-20" }),
    // Moved from HOUSEHOLD to HOME after its completion: counts for HOME now.
    tennerFixture({ tennerId: "m1", category: "HOME", nextDue: "2026-10-20" }),
  ];
  const result = categoryMetrics([done("f1", 30), done("f2", 30), done("h1", 20), done("m1", 20), done("gone", 50)], tenners, SEED_CATEGORIES, PERIOD, context);

  it("aggregates per current category and returns every category in display order", () => {
    expect(result.categories.map((c) => c.category)).toEqual(["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"]);
    expect(byId([...result.categories], "FITNESS")).toEqual({ category: "FITNESS", name: "Fitness", archived: false, activeTenners: 2, completions: 2, actualMinutes: 60, shareOfMinutes: 0.6, overdueNow: 1, healthScore: 0.5 });
    expect(byId([...result.categories], "HOME")).toMatchObject({ completions: 1, actualMinutes: 20, shareOfMinutes: 0.2, healthScore: 1 });
  });

  it("shares sum to 1 and empty categories have null health", () => {
    const shares = result.categories.map((c) => c.shareOfMinutes ?? 0);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(byId([...result.categories], "FAMILY")).toMatchObject({ activeTenners: 0, completions: 0, actualMinutes: 0, shareOfMinutes: 0, healthScore: null });
  });

  it("returns null shares without minutes and includes archived categories", () => {
    const archived: HouseholdCategory = { ...(SEED_CATEGORIES[0] as HouseholdCategory), archived: true };
    const empty = categoryMetrics([], [], [archived], PERIOD, context);
    expect(empty.categories).toEqual([expect.objectContaining({ category: "HOUSEHOLD", archived: true, shareOfMinutes: null, healthScore: null })]);
  });
});

describe("AnalyticsService.categories", () => {
  it("uses the household categories", async () => {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue([]);
    const custom: HouseholdCategory = { ...(SEED_CATEGORIES[0] as HouseholdCategory), categoryId: "GARTEN", name: "Garten" };
    const service = new AnalyticsService(repo, { listCompletions: vi.fn(async () => []), listSkips: vi.fn(async () => []) }, async () => toHouseholdResponse(undefined, "UTC"), () => new Date(`${TODAY}T10:00:00Z`), undefined, async () => [custom]);
    expect((await service.categories("default", {})).categories.map((c) => c.name)).toEqual(["Garten"]);
  });
});
