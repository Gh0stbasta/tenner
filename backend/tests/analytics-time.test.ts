/** ANALYTICS-005: time investment. */

import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, median, timeInvestment, type AnalyticsCompletion } from "../src/analytics/index.js";
import { toCompletion, toCompletionItem } from "../src/repositories/dynamodb/completion.mapper.js";
import { CompleteTennerService, toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockCompletionRepository, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const PERIOD = { from: "2026-09-08", to: "2026-10-07", days: 28 }; // 4 weeks for round numbers
const done = (tennerId: string, minutes: number, source?: "USER" | "DEFAULT"): AnalyticsCompletion => ({
  ...completionFixture({ tennerId, actualMinutes: minutes, ...(source ? { actualMinutesSource: source } : {}) }),
  date: "2026-10-01",
});

describe("timeInvestment", () => {
  const tenners = [
    tennerFixture({ tennerId: "w", title: "Fenster", estimatedMinutes: 10, frequencyDays: 7 }),
    tennerFixture({ tennerId: "b", title: "Bad", estimatedMinutes: 20, frequencyDays: 14 }),
    tennerFixture({ tennerId: "x", title: "Alt", estimatedMinutes: 60, frequencyDays: 7, active: false }),
  ];

  it("projects the weekly load and averages real minutes", () => {
    const result = timeInvestment([done("w", 30), done("b", 50)], tenners, PERIOD);
    expect(result).toMatchObject({ totalActualMinutes: 80, averageMinutesPerWeek: 20, projectedMinutesPerWeek: 20, tennersExceedingTenMinutes: 1 });
  });

  it("measures accuracy only over user-reported minutes", () => {
    const result = timeInvestment([done("w", 20, "USER"), done("b", 20, "USER"), done("w", 99, "DEFAULT"), done("b", 99)], tenners, PERIOD);
    expect(result.estimationAccuracy).toBe(0.75); // (10 + 20) ÷ (20 + 20)
    expect(result.reportedSamples).toBe(2);
  });

  it("lists Tenners whose median exceeds the estimate by 50 % with at least three samples", () => {
    const result = timeInvestment(
      [done("w", 25, "USER"), done("w", 20, "USER"), done("w", 5, "USER"), done("b", 40, "USER"), done("b", 40, "USER")],
      tenners,
      PERIOD,
    );
    expect(result.tennersExceedingEstimate).toEqual([{ tennerId: "w", title: "Fenster", estimatedMinutes: 10, medianActualMinutes: 20, samples: 3 }]);
  });

  it("returns empty values without data", () => {
    expect(timeInvestment([], [], PERIOD)).toMatchObject({ totalActualMinutes: 0, averageMinutesPerWeek: 0, projectedMinutesPerWeek: 0, estimationAccuracy: null, reportedSamples: 0, tennersExceedingEstimate: [] });
  });

  it("computes the median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("actualMinutesSource", () => {
  async function complete(actualMinutes?: number) {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tennerFixture());
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => new Date("2026-10-05T08:00:00Z"), () => "c-1", async () => "UTC");
    await service.completeTenner(TEST_IDENTITY, "t-1", actualMinutes === undefined ? {} : { actualMinutes });
    return tenners.completeTenner.mock.calls[0]?.[1].completion;
  }

  it("records USER for sent minutes and DEFAULT for the estimate; older records have none", async () => {
    expect(await complete(25)).toMatchObject({ actualMinutes: 25, actualMinutesSource: "USER" });
    expect(await complete()).toMatchObject({ actualMinutes: 10, actualMinutesSource: "DEFAULT" });
    expect(toCompletion(toCompletionItem({ completion: completionFixture({ actualMinutesSource: "USER" }) })).actualMinutesSource).toBe("USER");
    expect(toCompletion({ ...toCompletionItem({ completion: completionFixture() }), actualMinutesSource: "OTHER" })).not.toHaveProperty("actualMinutesSource");
  });
});

describe("AnalyticsService.time", () => {
  it("aggregates the period", async () => {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue([tennerFixture({ estimatedMinutes: 10, frequencyDays: 7 })]);
    const listCompletions = vi.fn(async () => [completionFixture({ completedAt: "2026-10-01T10:00:00Z", actualMinutes: 70 })]);
    const service = new AnalyticsService(repo, { listCompletions, listSkips: vi.fn(async () => []) }, async () => toHouseholdResponse(undefined, "UTC"), () => new Date("2026-10-07T10:00:00Z"));
    expect(await service.time("default", { from: "2026-09-10", to: "2026-10-07" })).toMatchObject({ totalActualMinutes: 70, averageMinutesPerWeek: 18, projectedMinutesPerWeek: 10 });
  });
});
