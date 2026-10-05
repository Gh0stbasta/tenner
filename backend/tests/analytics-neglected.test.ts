/** ANALYTICS-006: neglected Tenners. */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, expectedCompletions, neglectedTenners, overlapDays, scoreTenner, type AnalyticsCompletion } from "../src/analytics/index.js";
import type { SkipEvent, Tenner } from "../src/models/index.js";
import { DynamoDbCompletionRepository } from "../src/repositories/index.js";
import { toSkipEvent, toSkipItem } from "../src/repositories/dynamodb/completion.mapper.js";
import { toHouseholdResponse } from "../src/services/index.js";
import { completionFixture, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const TODAY = "2026-10-07";
const PERIOD = { from: "2026-07-10", to: TODAY, days: 90 };
const context = { today: TODAY, vacation: null };
const UTC = "UTC";
const weekly = (overrides: Partial<Tenner> = {}): Tenner =>
  tennerFixture({ tennerId: "w", title: "Weekly", frequencyDays: 7, frequencyUnit: "WEEK", frequencyInterval: 1, createdAt: "2026-01-01T10:00:00Z", lastCompleted: "2026-09-24T10:00:00Z", nextDue: "2026-10-01", ...overrides });
const done = (n: number, tennerId = "w"): AnalyticsCompletion[] => Array.from({ length: n }, (_, i) => ({ ...completionFixture({ tennerId, completionId: `c${i}` }), date: "2026-09-01" }));
const skip = (tennerId = "w"): SkipEvent => ({ tenantId: "default", skipId: "s1", tennerId, skippedBy: "STEFAN", skippedAt: "2026-09-10T10:00:00Z", skippedDue: "2026-09-10", nextDue: "2026-09-17", reason: null });

describe("scoreTenner", () => {
  it("computes fulfillment and the neglect score", () => {
    expect(scoreTenner(weekly(), done(4), 0, PERIOD, context, UTC)).toEqual({
      tennerId: "w",
      title: "Weekly",
      assignedTo: "STEFAN",
      category: "HOUSEHOLD",
      daysOverdue: 6,
      daysSinceCompleted: 13,
      expectedCompletions: 12,
      actualCompletions: 4,
      fulfillmentRatio: 0.3333,
      neglectScore: 0.7429, // (1 − 4/12) × 0.6 + 6/7 × 0.4
    });
  });

  it("caps the ratio at 1 and the overdue part at one interval", () => {
    expect(scoreTenner(weekly({ nextDue: TODAY }), done(20), 0, PERIOD, context, UTC)).toMatchObject({ fulfillmentRatio: 1, neglectScore: 0 });
    expect(scoreTenner(weekly({ nextDue: "2026-08-01" }), done(20), 0, PERIOD, context, UTC).neglectScore).toBe(0.4);
  });

  it("treats a never completed Tenner older than one interval as fully neglected", () => {
    expect(scoreTenner(weekly({ lastCompleted: null, createdAt: "2026-09-01T08:00:00Z", nextDue: "2026-09-01" }), [], 0, PERIOD, context, UTC)).toMatchObject({ daysSinceCompleted: null, fulfillmentRatio: 0, neglectScore: 1 });
  });

  it("does not judge a recently created Tenner", () => {
    const fresh = weekly({ lastCompleted: null, createdAt: "2026-10-04T08:00:00Z", nextDue: "2026-10-04" });
    expect(scoreTenner(fresh, [], 0, PERIOD, context, UTC)).toMatchObject({ expectedCompletions: 0, fulfillmentRatio: 1, daysOverdue: 3, neglectScore: 0.1714 });
    // Created inside the period: the period starts at creation.
    expect(expectedCompletions(weekly({ createdAt: "2026-09-16T08:00:00Z" }), PERIOD, 0, context, UTC)).toBe(3);
  });

  it("excludes skipped cycles, the vacation and the current pause from expected completions", () => {
    expect(expectedCompletions(weekly(), PERIOD, 2, context, UTC)).toBe(10);
    const vacation = { from: "2026-08-01", until: "2026-08-28", categories: null };
    expect(expectedCompletions(weekly(), PERIOD, 0, { today: TODAY, vacation }, UTC)).toBe(8); // 62 days
    expect(expectedCompletions(weekly(), PERIOD, 0, { today: TODAY, vacation: { ...vacation, categories: ["FITNESS"] } }, UTC)).toBe(12);
    const paused = weekly({ pausedAt: "2026-09-08T08:00:00Z", pausedUntil: null });
    expect(expectedCompletions(paused, PERIOD, 0, context, UTC)).toBe(8); // 60 days before the pause
    expect(scoreTenner(paused, [], 0, PERIOD, context, UTC).daysOverdue).toBe(0);
    expect(overlapDays({ from: "2026-01-01", to: "2026-01-05" }, { from: "2026-01-06", to: "2026-01-09" })).toBe(0);
  });
});

describe("neglectedTenners", () => {
  it("sorts by score, then overdue days, then title; drops inactive and unneglected Tenners; limits", () => {
    const tenners = [
      weekly({ tennerId: "a", title: "Alpha" }),
      weekly({ tennerId: "b", title: "Beta", lastCompleted: null, createdAt: "2026-09-01T08:00:00Z", nextDue: "2026-09-01" }),
      weekly({ tennerId: "c", title: "Charlie", nextDue: TODAY }),
      weekly({ tennerId: "d", title: "Delta", active: false, nextDue: "2026-01-01" }),
      weekly({ tennerId: "e", title: "Echo" }),
    ];
    const completions = [...done(4, "a"), ...done(12, "c"), ...done(4, "e")];
    const items = neglectedTenners(completions, [skip("c")], tenners, PERIOD, context, UTC, 10);
    expect(items.map((item) => item.tennerId)).toEqual(["b", "a", "e"]);
    expect(neglectedTenners(completions, [], tenners, PERIOD, context, UTC, 1)).toHaveLength(1);
  });
});

describe("listSkips", () => {
  it("queries the base table on the skip prefix and maps the items", async () => {
    const send = vi.fn().mockResolvedValueOnce({ Items: [toSkipItem(skip())], LastEvaluatedKey: { k: 1 } }).mockResolvedValueOnce({ Items: [] });
    const result = await new DynamoDbCompletionRepository({ send }, "tenner-history").listSkips("default", "2026-07-10", TODAY);
    expect(result).toEqual([skip()]);
    const input = (send.mock.calls[0]?.[0] as QueryCommand).input;
    expect(input).toMatchObject({ KeyConditionExpression: "#tenantId = :tenantId AND begins_with(#historyId, :prefix)", ExpressionAttributeValues: { ":prefix": "skip#", ":from": "2026-07-10", ":to": TODAY } });
    expect(input).not.toHaveProperty("IndexName");
    expect(toSkipEvent({ ...toSkipItem(skip()), reason: "Urlaub" }).reason).toBe("Urlaub");
    await expect(new DynamoDbCompletionRepository({ send: vi.fn().mockRejectedValue(new Error("x")) }, "t").listSkips("d", "a", "b")).rejects.toMatchObject({ code: "PERSISTENCE_ERROR" });
  });
});

describe("AnalyticsService.neglected", () => {
  it("defaults to last90 and limit 10", async () => {
    const repo = mockTennerRepository();
    repo.list.mockResolvedValue(Array.from({ length: 12 }, (_, i) => weekly({ tennerId: `t${i}`, title: `T${i}` })));
    const listSkips = vi.fn(async () => []);
    const service = new AnalyticsService(repo, { listCompletions: vi.fn(async () => []), listSkips }, async () => toHouseholdResponse(undefined, UTC), () => new Date(`${TODAY}T10:00:00Z`));
    const result = await service.neglected("default", {});
    expect(result.period).toEqual({ from: "2026-07-10", to: TODAY });
    expect(result.items).toHaveLength(10);
    expect(listSkips).toHaveBeenCalledWith("default", "2026-07-10", TODAY);
    expect((await service.neglected("default", { limit: 3, period: "last30" })).items).toHaveLength(3);
  });
});
