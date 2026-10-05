/** SCHEDULING-005: pause and vacation mode. */

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { endVacationHandler, setVacationHandler } from "../src/handlers/household.js";
import { pauseTennerHandler, resumeTennerHandler } from "../src/handlers/pause-tenner.js";
import type { Tenner, Vacation } from "../src/models/index.js";
import { DynamoDbTennerRepository } from "../src/repositories/index.js";
import { CompleteTennerService, DashboardService, PauseTennerService, SkipTennerService, VacationService } from "../src/services/index.js";
import {
  affectedByVacation,
  averageDailyLoad,
  avoidVacation,
  distributeResume,
  isOnVacation,
  isPaused,
  pausedUntilOf,
} from "../src/utils/pause.js";
import { mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

// Monday, 5 Oct 2026, 10:00 in Berlin.
const NOW = new Date("2026-10-05T08:00:00Z");
const TODAY = "2026-10-05";
const BERLIN = async () => "Europe/Berlin";
const VACATION: Vacation = { from: "2026-10-10", until: "2026-10-24", categories: ["HOUSEHOLD", "HOME"] };

const t = (tennerId: string, overrides: Partial<Tenner> = {}) => tennerFixture({ tennerId, title: tennerId, ...overrides });

describe("pause rules", () => {
  it("evaluates individual pauses at read time, so a pause with an end date ends on its own", () => {
    const paused = t("a", { pausedAt: "2026-10-01T08:00:00Z", pausedUntil: "2026-10-07" });
    expect(isPaused(paused, null, "2026-10-07")).toBe(true);
    expect(isPaused(paused, null, "2026-10-08")).toBe(false);
    expect(isPaused(t("b", { pausedAt: "2026-10-01T08:00:00Z", pausedUntil: null }), null, "2030-01-01")).toBe(true);
    expect(isPaused(t("c"), null, TODAY)).toBe(false);
  });

  it("pauses vacation categories only between from and until", () => {
    expect(isOnVacation(t("a", { category: "HOME" }), VACATION, "2026-10-09")).toBe(false);
    expect(isOnVacation(t("a", { category: "HOME" }), VACATION, "2026-10-10")).toBe(true);
    expect(isOnVacation(t("a", { category: "HOME" }), VACATION, "2026-10-24")).toBe(true);
    expect(isOnVacation(t("a", { category: "HOME" }), VACATION, "2026-10-25")).toBe(false);
    expect(isOnVacation(t("b", { category: "FITNESS" }), VACATION, "2026-10-12")).toBe(false);
    expect(isOnVacation(t("b", { category: "FITNESS" }), { ...VACATION, categories: null }, "2026-10-12")).toBe(true);
  });

  it("reports the latest pause end; null for open-ended pauses", () => {
    const home = t("a", { category: "HOME", pausedAt: "x", pausedUntil: "2026-10-30" });
    expect(pausedUntilOf(home, VACATION, "2026-10-12")).toBe("2026-10-30");
    expect(pausedUntilOf(t("b", { category: "HOME" }), VACATION, "2026-10-12")).toBe("2026-10-24");
    expect(pausedUntilOf(t("c", { category: "HOME", pausedAt: "x", pausedUntil: null }), VACATION, "2026-10-12")).toBeNull();
  });

  it("moves Tenners due within the vacation, and overdue ones once it has started", () => {
    expect(affectedByVacation(t("a", { category: "HOME", nextDue: "2026-10-12" }), VACATION, TODAY)).toBe(true);
    expect(affectedByVacation(t("b", { category: "HOME", nextDue: "2026-10-07" }), VACATION, TODAY)).toBe(false);
    expect(affectedByVacation(t("c", { category: "HOME", nextDue: "2026-10-07" }), VACATION, "2026-10-10")).toBe(true);
    expect(affectedByVacation(t("d", { category: "HOME", nextDue: "2026-10-25" }), VACATION, TODAY)).toBe(false);
    expect(affectedByVacation(t("e", { category: "FITNESS", nextDue: "2026-10-12" }), VACATION, TODAY)).toBe(false);
  });

  it("moves new due dates out of the vacation", () => {
    expect(avoidVacation("2026-10-12", t("a", { category: "HOME" }), VACATION)).toBe("2026-10-25");
    expect(avoidVacation("2026-10-12", t("a", { category: "FITNESS" }), VACATION)).toBe("2026-10-12");
    expect(avoidVacation("2026-10-09", t("a", { category: "HOME" }), VACATION)).toBe("2026-10-09");
    expect(avoidVacation("2026-10-12", t("a"), null)).toBe("2026-10-12");
  });

  it("computes the average daily load", () => {
    expect(averageDailyLoad([t("a", { estimatedMinutes: 14, frequencyDays: 7 }), t("b", { estimatedMinutes: 30, frequencyDays: 30 })])).toBe(3);
  });

  it("spreads resumed Tenners under the load cap, oldest due first, at least one per day", () => {
    const moved = [
      t("late", { nextDue: "2026-10-20", estimatedMinutes: 20 }),
      t("early", { nextDue: "2026-10-11", estimatedMinutes: 20 }),
      t("long", { nextDue: "2026-10-15", estimatedMinutes: 90 }),
      t("small", { nextDue: "2026-10-21", estimatedMinutes: 10 }),
    ];
    const existing = [t("fixed", { nextDue: "2026-10-26", estimatedMinutes: 25 })];
    const result = distributeResume(moved, existing, "2026-10-25", 30);
    expect(Object.fromEntries(result)).toEqual({
      early: "2026-10-25",
      long: "2026-10-27", // 25: 20 used, 26: 25 existing; 90 > cap → first empty day
      late: "2026-10-28",
      small: "2026-10-25", // 20 + 10 = 30 fits on the first day
    });
  });
});

describe("PauseTennerService", () => {
  function setup(tenner: Tenner) {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tenner);
    tenners.updateSchedule.mockImplementation(async (_tenant, _id, changes) => ({ ...tenner, ...changes }));
    return { tenners, service: new PauseTennerService(tenners, () => NOW, BERLIN) };
  }

  it("pauses until a date and moves a due date inside the pause behind it", async () => {
    const { tenners, service } = setup(t("a", { nextDue: "2026-10-08", updatedAt: "u1" }));
    const response = await service.pause(TEST_IDENTITY, "a", { until: "2026-10-12" });
    expect(tenners.updateSchedule).toHaveBeenCalledWith("default", "a", { pausedAt: "2026-10-05T08:00:00Z", pausedUntil: "2026-10-12", nextDue: "2026-10-13" }, "u1", "2026-10-05T08:00:00Z", "STEFAN");
    expect(response).toMatchObject({ pausedUntil: "2026-10-12", nextDue: "2026-10-13" });
  });

  it("keeps due dates after the pause and pauses open-ended without moving the date", async () => {
    const later = setup(t("a", { nextDue: "2026-10-20" }));
    await later.service.pause(TEST_IDENTITY, "a", { until: "2026-10-12" });
    expect(later.tenners.updateSchedule.mock.calls[0]?.[2]).toEqual({ pausedAt: "2026-10-05T08:00:00Z", pausedUntil: "2026-10-12" });
    const open = setup(t("b", { nextDue: "2026-10-01" }));
    await open.service.pause(TEST_IDENTITY, "b", {});
    expect(open.tenners.updateSchedule.mock.calls[0]?.[2]).toEqual({ pausedAt: "2026-10-05T08:00:00Z", pausedUntil: null });
  });

  it("rejects pause dates that are not in the future and inactive Tenners", async () => {
    await expect(setup(t("a")).service.pause(TEST_IDENTITY, "a", { until: TODAY })).rejects.toBeInstanceOf(ValidationError);
    await expect(setup(t("a", { active: false })).service.pause(TEST_IDENTITY, "a", {})).rejects.toMatchObject({ code: "TENNER_INACTIVE" });
    const missing = setup(t("a"));
    missing.tenners.getById.mockResolvedValue(undefined);
    await expect(missing.service.pause(TEST_IDENTITY, "x", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resumes: a due date that passed during the pause becomes today", async () => {
    const { tenners, service } = setup(t("a", { nextDue: "2026-09-28", pausedAt: "2026-09-20T08:00:00Z", pausedUntil: null }));
    await service.resume(TEST_IDENTITY, "a");
    expect(tenners.updateSchedule.mock.calls[0]?.[2]).toEqual({ pausedAt: null, pausedUntil: null, nextDue: TODAY });
  });

  it("resumes early without moving a future due date", async () => {
    const { tenners, service } = setup(t("a", { nextDue: "2026-10-13", pausedAt: "x", pausedUntil: "2026-10-12" }));
    await service.resume(TEST_IDENTITY, "a");
    expect(tenners.updateSchedule.mock.calls[0]?.[2]).toEqual({ pausedAt: null, pausedUntil: null });
  });

  it("rejects resuming a Tenner that is not (or no longer) paused", async () => {
    await expect(setup(t("a")).service.resume(TEST_IDENTITY, "a")).rejects.toMatchObject({ code: "TENNER_NOT_PAUSED", statusCode: 409 });
    await expect(setup(t("a", { pausedAt: "x", pausedUntil: "2026-10-01" })).service.resume(TEST_IDENTITY, "a")).rejects.toMatchObject({ code: "TENNER_NOT_PAUSED" });
  });
});

describe("VacationService", () => {
  function setup(tenners: Tenner[], conflictFor: string[] = []) {
    const households = { saveVacation: vi.fn(async (tenantId: string, vacation: Vacation | null) => ({ tenantId, timezone: null, vacation, members: null, membersVersion: 0, updatedAt: "ts", updatedBy: "STEFAN" })) };
    const repository = mockTennerRepository();
    repository.list.mockResolvedValue(tenners);
    repository.updateSchedule.mockImplementation(async (_tenant, id) => {
      if (conflictFor.includes(id)) throw new ConflictError("changed", "CONCURRENT_MODIFICATION");
      return t(id);
    });
    const logger = mockLogger();
    return { households, repository, logger, service: new VacationService(households, repository, () => NOW, BERLIN, logger) };
  }

  it("saves the vacation per category and spreads affected Tenners behind it", async () => {
    const { households, repository, service } = setup([
      t("vacuum", { category: "HOUSEHOLD", nextDue: "2026-10-12", estimatedMinutes: 30, frequencyDays: 7 }),
      t("windows", { category: "HOME", nextDue: "2026-10-20", estimatedMinutes: 30, frequencyDays: 7 }),
      t("ride", { category: "FITNESS", nextDue: "2026-10-12", estimatedMinutes: 60, frequencyDays: 7 }),
      t("before", { category: "HOME", nextDue: "2026-10-08" }),
    ]);
    const result = await service.setVacation(TEST_IDENTITY, { from: "2026-10-10", until: "2026-10-24", categories: ["HOUSEHOLD", "HOME"] });
    expect(households.saveVacation).toHaveBeenCalledWith("default", VACATION, "STEFAN", "2026-10-05T08:00:00Z");
    // cap = (30/7 + 30/7 + 60/7 + 10/14) × 1.5 ≈ 26.8 → one 30-minute Tenner per day
    expect(repository.updateSchedule.mock.calls.map(([, id, changes]) => [id, changes])).toEqual([
      ["vacuum", { nextDue: "2026-10-25" }],
      ["windows", { nextDue: "2026-10-26" }],
    ]);
    expect(result).toEqual({ household: { timezone: "Europe/Berlin", vacation: VACATION }, rescheduled: 2, conflicts: 0 });
  });

  it("defaults to all categories and counts concurrent changes as conflicts", async () => {
    const { repository, logger, service } = setup([t("a", { category: "FITNESS", nextDue: "2026-10-12" }), t("b", { nextDue: "2026-10-13" })], ["b"]);
    const result = await service.setVacation(TEST_IDENTITY, { from: "2026-10-10", until: "2026-10-24" });
    expect(repository.updateSchedule).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ rescheduled: 1, conflicts: 1, household: { vacation: { categories: null } } });
    expect(logger.warn).toHaveBeenCalledWith("Vacation reschedule skipped", { tennerId: "b", errorCode: "CONCURRENT_MODIFICATION" });
  });

  it("propagates storage failures and rejects vacations in the past", async () => {
    const failing = setup([t("a", { nextDue: "2026-10-12" })]);
    failing.repository.updateSchedule.mockRejectedValue(new PersistenceError());
    await expect(failing.service.setVacation(TEST_IDENTITY, { from: "2026-10-10", until: "2026-10-24" })).rejects.toBeInstanceOf(PersistenceError);
    await expect(setup([]).service.setVacation(TEST_IDENTITY, { from: "2026-09-01", until: "2026-10-04" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("ends the vacation without moving due dates back", async () => {
    const { households, repository, service } = setup([]);
    await expect(service.endVacation(TEST_IDENTITY)).resolves.toEqual({ timezone: "Europe/Berlin", vacation: null });
    expect(households.saveVacation).toHaveBeenCalledWith("default", null, "STEFAN", "2026-10-05T08:00:00Z");
    expect(repository.updateSchedule).not.toHaveBeenCalled();
  });
});

describe("dashboard with pauses", () => {
  function dashboard(tenners: Tenner[], vacation: Vacation | null, now = NOW) {
    const repository = mockTennerRepository();
    repository.getDashboardCandidates.mockResolvedValue(tenners);
    repository.list.mockResolvedValue(tenners);
    return new DashboardService(repository, () => now, BERLIN, async () => vacation).getDashboard("default");
  }

  it("excludes paused Tenners from sections and summaries and lists them separately", async () => {
    const result = await dashboard(
      [
        t("due", { nextDue: TODAY }),
        t("paused", { nextDue: "2026-10-01", pausedAt: "x", pausedUntil: "2026-10-12" }),
        t("vacation", { category: "HOME", nextDue: "2026-10-02" }),
        t("fitness", { category: "FITNESS", nextDue: "2026-10-02" }),
      ],
      { from: "2026-10-01", until: "2026-10-09", categories: ["HOME"] },
    );
    expect(result.dueToday.map((i) => i.tennerId)).toEqual(["due"]);
    expect(result.overdue.map((i) => i.tennerId)).toEqual(["fitness"]);
    expect(result.summary).toMatchObject({ dueTodayCount: 1, overdueCount: 1 });
    expect(result.paused).toEqual([
      expect.objectContaining({ tennerId: "paused", pausedUntil: "2026-10-12", pauseReason: "PAUSE" }),
      expect.objectContaining({ tennerId: "vacation", pausedUntil: "2026-10-09", pauseReason: "VACATION" }),
    ]);
  });

  it("brings a Tenner back automatically after its pause date", async () => {
    const result = await dashboard([t("a", { nextDue: "2026-10-13", pausedAt: "x", pausedUntil: "2026-10-12" })], null, new Date("2026-10-13T08:00:00Z"));
    expect(result.dueToday.map((i) => i.tennerId)).toEqual(["a"]);
    expect(result.paused).toEqual([]);
  });
});

describe("completion and skip during pauses", () => {
  it("completion ends an individual pause and moves a due date out of the vacation", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(t("a", { category: "HOME", frequencyUnit: "WEEK", frequencyInterval: 1, frequencyDays: 7, pausedAt: "x", pausedUntil: null }));
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => NOW, () => "c-1", BERLIN, async () => VACATION);
    await service.completeTenner(TEST_IDENTITY, "a", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0]).toMatchObject({ nextDue: "2026-10-25", pausedAt: null, pausedUntil: null });
  });

  it("skip moves a due date out of the vacation", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(t("a", { category: "HOME", nextDue: TODAY, frequencyUnit: "WEEK", frequencyInterval: 1, frequencyDays: 7 }));
    tenners.skipTenner.mockResolvedValue(undefined);
    await new SkipTennerService(tenners, () => NOW, () => "k-1", BERLIN, async () => VACATION).skipTenner(TEST_IDENTITY, "a", {});
    expect(tenners.skipTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-25");
  });
});

describe("DynamoDbTennerRepository.updateSchedule", () => {
  it("sets only the given fields with optimistic locking", async () => {
    const send = vi.fn<(command: unknown) => Promise<unknown>>(async () => ({ Attributes: { ...t("a"), pausedAt: "p", pausedUntil: null } }));
    const result = await new DynamoDbTennerRepository({ send }, "tenner-tenners", "tenner-history").updateSchedule("default", "a", { pausedAt: "p", pausedUntil: null }, "u1", "ts", "JULIA");
    const input = (send.mock.calls[0]?.[0] as UpdateCommand).input;
    expect(input.UpdateExpression).toBe("SET #pausedAt = :pausedAt, #pausedUntil = :pausedUntil, #updatedAt = :timestamp, #updatedBy = :actor");
    expect(input.ConditionExpression).toBe("attribute_exists(tennerId) AND #updatedAt = :expectedUpdatedAt AND #active = :true AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":pausedAt": "p", ":pausedUntil": null, ":expectedUpdatedAt": "u1", ":actor": "JULIA" });
    expect(result).toMatchObject({ pausedAt: "p", pausedUntil: null });
  });

  it("maps failed conditions to 409 and other failures to PersistenceError", async () => {
    const repo = (error: Error | undefined) =>
      new DynamoDbTennerRepository({ send: vi.fn<(command: unknown) => Promise<unknown>>(async () => (error ? Promise.reject(error) : {})) }, "t", "h");
    await expect(repo(Object.assign(new Error("c"), { name: "ConditionalCheckFailedException" })).updateSchedule("d", "a", {}, "u", "ts", "STEFAN")).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    await expect(repo(new Error("boom")).updateSchedule("d", "a", {}, "u", "ts", "STEFAN")).rejects.toBeInstanceOf(PersistenceError);
    await expect(repo(undefined).updateSchedule("d", "a", {}, "u", "ts", "STEFAN")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("pause and vacation handlers", () => {
  const event = (body: string | undefined, tennerId = "t-1") => ({ body, isBase64Encoded: false, pathParameters: { tennerId } }) as unknown as APIGatewayProxyEventV2;
  const paused = { tennerId: "t-1", pausedUntil: "2026-10-12", nextDue: "2026-10-13" } as never;

  it("pauses with an empty body or an until date and logs it", async () => {
    const logger = mockLogger();
    const pause = vi.fn(async () => paused);
    await pauseTennerHandler(event(undefined), TEST_IDENTITY, pause, logger);
    expect(pause).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", {});
    await pauseTennerHandler(event(JSON.stringify({ until: "2026-10-12" })), TEST_IDENTITY, pause, logger);
    expect(pause).toHaveBeenLastCalledWith(TEST_IDENTITY, "t-1", { until: "2026-10-12" });
    expect(logger.info).toHaveBeenCalledWith("Tenner paused", { event: "TennerPaused", tennerId: "t-1", pausedBy: "STEFAN", pausedUntil: "2026-10-12", nextDue: "2026-10-13" });
    await expect(pauseTennerHandler(event(JSON.stringify({ until: "2026-02-30" })), TEST_IDENTITY, pause, logger)).rejects.toBeInstanceOf(ValidationError);
  });

  it("resumes and logs it", async () => {
    const logger = mockLogger();
    const response = await resumeTennerHandler(event(undefined), TEST_IDENTITY, vi.fn(async () => paused), logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Tenner resumed", { event: "TennerResumed", tennerId: "t-1", resumedBy: "STEFAN", nextDue: "2026-10-13" });
  });

  it("validates and sets the vacation", async () => {
    const logger = mockLogger();
    const set = vi.fn(async () => ({ household: { timezone: "Europe/Berlin", vacation: VACATION }, rescheduled: 3, conflicts: 0 }));
    const response = await setVacationHandler(event(JSON.stringify({ from: "2026-10-10", until: "2026-10-24", categories: ["HOUSEHOLD", "HOME"] })), TEST_IDENTITY, set, logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Household vacation set", { event: "HouseholdVacationSet", from: "2026-10-10", until: "2026-10-24", categories: ["HOUSEHOLD", "HOME"], rescheduled: 3, conflicts: 0 });
    for (const body of [
      { from: "2026-10-24", until: "2026-10-10" },
      { from: "2026-10-10", until: "2026-10-24", categories: [] },
      { from: "2026-10-10", until: "2026-10-24", categories: ["HOME", "HOME"] },
      { from: "2026-10-10" },
      { from: "2026-10-10", until: "2026-10-24", extra: true },
    ]) {
      await expect(setVacationHandler(event(JSON.stringify(body)), TEST_IDENTITY, set, logger)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("ends the vacation", async () => {
    const logger = mockLogger();
    const response = await endVacationHandler(TEST_IDENTITY, vi.fn(async () => ({ timezone: "Europe/Berlin", vacation: null })), logger);
    expect(JSON.parse(response.body ?? "").data).toEqual({ timezone: "Europe/Berlin", vacation: null });
    expect(logger.info).toHaveBeenCalledWith("Household vacation ended", { event: "HouseholdVacationEnded", endedBy: "STEFAN" });
  });
});
