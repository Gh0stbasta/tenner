/** REC-001: Tenners not completed on their day disappear until their next occurrence and count as not done. */

import { describe, expect, it } from "vitest";
import { toSkipEvent, toSkipItem } from "../src/repositories/dynamodb/completion.mapper.js";
import { MAX_MISSED_OCCURRENCES, MissedTennerService, nextDueAfterMiss } from "../src/services/index.js";
import { ConflictError } from "../src/exceptions/index.js";
import type { Tenner, Vacation } from "../src/models/index.js";
import { mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

// Monday, 5 Oct 2026, 00:15 in Berlin.
const NOW = new Date("2026-10-04T22:15:00Z");
const TODAY = "2026-10-05";

function setup(list: Tenner[], vacation: Vacation | null = null) {
  const tenners = mockTennerRepository();
  tenners.list.mockResolvedValue(list);
  tenners.skipTenner.mockResolvedValue(undefined);
  const logger = mockLogger();
  let id = 0;
  const service = new MissedTennerService(tenners, () => NOW, () => `m-${++id}`, async () => "Europe/Berlin", async () => vacation, logger);
  return { tenners, service, logger };
}

describe("nextDueAfterMiss", () => {
  it.each([
    ["daily, missed yesterday", { frequencyUnit: "DAY" as const, frequencyInterval: 1, nextDue: "2026-10-04" }, "2026-10-05", 1],
    ["daily, three days missed", { frequencyUnit: "DAY" as const, frequencyInterval: 1, nextDue: "2026-10-02" }, "2026-10-05", 3],
    ["weekly", { frequencyUnit: "WEEK" as const, frequencyInterval: 1, nextDue: "2026-10-03" }, "2026-10-10", 1],
    ["monthly", { frequencyUnit: "MONTH" as const, frequencyInterval: 1, nextDue: "2026-09-30" }, "2026-10-30", 1],
    ["yearly", { frequencyUnit: "YEAR" as const, frequencyInterval: 1, nextDue: "2026-10-01" }, "2027-10-01", 1],
  ])("%s", (_name, schedule, nextDue, missedCount) => {
    expect(nextDueAfterMiss({ weekdays: null, ...schedule }, TODAY)).toEqual({ nextDue, missedCount });
  });

  it("follows weekdays and leaves Tenners due today alone", () => {
    expect(nextDueAfterMiss({ frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: ["MON", "THU"], nextDue: "2026-10-01" }, TODAY)).toEqual({ nextDue: "2026-10-05", missedCount: 1 });
    expect(nextDueAfterMiss({ frequencyUnit: "DAY", frequencyInterval: 1, weekdays: null, nextDue: TODAY }, TODAY)).toEqual({ nextDue: TODAY, missedCount: 0 });
  });

  it("stops counting after a bounded number of occurrences", () => {
    const result = nextDueAfterMiss({ frequencyUnit: "DAY", frequencyInterval: 1, weekdays: null, nextDue: "2020-01-01" }, TODAY);
    expect(result.missedCount).toBe(MAX_MISSED_OCCURRENCES);
  });
});

describe("MissedTennerService", () => {
  it("moves a missed Tenner to its next occurrence and records the miss for the assignee", async () => {
    const missed = tennerFixture({ tennerId: "t-1", frequencyUnit: "DAY", frequencyInterval: 1, frequencyDays: 1, nextDue: "2026-10-03", snoozedUntil: "2026-10-03" });
    const { tenners, service } = setup([missed]);
    expect(await service.moveMissed("default")).toBe(1);
    expect(tenners.list).toHaveBeenCalledWith("default", { active: true, nextDueBefore: TODAY });
    const [updated, event, expected] = tenners.skipTenner.mock.calls[0] ?? [];
    expect(updated).toMatchObject({ nextDue: TODAY, snoozedUntil: null, updatedBy: "SYSTEM", lastCompleted: null });
    expect(expected).toBe(missed);
    expect(event).toEqual({
      tenantId: "default",
      skipId: "m-1",
      tennerId: "t-1",
      skippedBy: "STEFAN",
      skippedAt: "2026-10-04T22:15:00Z",
      skippedDue: "2026-10-03",
      nextDue: TODAY,
      reason: null,
      missed: true,
      missedCount: 2,
    });
  });

  it("leaves paused and inactive Tenners and Tenners due today alone", async () => {
    const { tenners, service } = setup([
      tennerFixture({ tennerId: "paused", pausedAt: "2026-09-01T00:00:00Z", pausedUntil: null }),
      tennerFixture({ tennerId: "today", nextDue: TODAY }),
    ]);
    expect(await service.moveMissed("default")).toBe(0);
    expect(tenners.skipTenner).not.toHaveBeenCalled();
  });

  it("keeps the next occurrence out of the household vacation", async () => {
    const vacation: Vacation = { from: "2026-10-06", until: "2026-10-12", categories: null };
    const { tenners, service } = setup([tennerFixture({ frequencyUnit: "DAY", frequencyInterval: 2, nextDue: "2026-10-04" })], vacation);
    await service.moveMissed("default");
    expect(tenners.skipTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-13");
  });

  it("skips a Tenner changed at the same moment and moves the others", async () => {
    const { tenners, service, logger } = setup([tennerFixture({ tennerId: "a", nextDue: "2026-10-01" }), tennerFixture({ tennerId: "b", nextDue: "2026-10-01" })]);
    tenners.skipTenner.mockRejectedValueOnce(new ConflictError("changed", "CONCURRENT_MODIFICATION"));
    expect(await service.moveMissed("default")).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith("Missed Tenner not moved", { event: "MissedTennerSkipped", tennerId: "a", error: "ConflictError" });
  });
});

describe("missed event mapping", () => {
  it("stores the miss with its count; plain skips stay unchanged", () => {
    const base = { tenantId: "default", skipId: "m-1", tennerId: "t-1", skippedBy: "STEFAN", skippedAt: "2026-10-04T22:15:00Z", skippedDue: "2026-10-03", nextDue: TODAY, reason: null };
    const item = toSkipItem({ ...base, missed: true, missedCount: 2 });
    expect(item).toMatchObject({ eventType: "SKIP", missed: true, missedCount: 2 });
    expect(toSkipEvent(item)).toEqual({ ...base, missed: true, missedCount: 2 });
    expect(toSkipItem(base)).not.toHaveProperty("missed");
    expect(toSkipEvent(toSkipItem(base))).toEqual(base);
  });
});
