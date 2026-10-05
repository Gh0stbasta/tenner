import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { dashboardHandler } from "../src/handlers/dashboard.js";
import type { Tenner } from "../src/models/index.js";
import { DashboardService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const REF = "2026-10-01";
const t = (id: string, overrides: Partial<Tenner>): Tenner => tennerFixture({ tennerId: id, title: id, ...overrides });

const mixed = [
  t("due-b", { nextDue: REF, estimatedMinutes: 10, title: "Vacuum Office", assignedTo: "STEFAN", category: "HOUSEHOLD" }),
  t("due-a", { nextDue: REF, estimatedMinutes: 10, title: "Mobility Workout", assignedTo: "JULIA", category: "FITNESS" }),
  t("due-c", { nextDue: REF, estimatedMinutes: 5, title: "Water Plants", assignedTo: "STEFAN", category: "HOME" }),
  t("over-1", { nextDue: "2026-09-28", estimatedMinutes: 15, title: "Clean Front Door", assignedTo: "STEFAN", category: "HOME" }),
  t("over-2", { nextDue: "2026-09-20", estimatedMinutes: 20, title: "Wash Car", assignedTo: "JULIA", category: "HOME" }),
  t("up-1", { nextDue: "2026-10-04", estimatedMinutes: 20, title: "Wash Windows", assignedTo: "JULIA", category: "HOME" }),
  t("up-2", { nextDue: "2026-10-08", estimatedMinutes: 30, title: "Review Finances", assignedTo: "STEFAN", category: "FINANCE" }),
  t("up-3", { nextDue: "2026-10-04", estimatedMinutes: 10, title: "Change Sheets", assignedTo: "STEFAN", category: "HOUSEHOLD" }),
  t("eight-days", { nextDue: "2026-10-09", estimatedMinutes: 10 }),
  t("inactive", { nextDue: REF, active: false }),
  t("deleted", { nextDue: REF, active: false, deletedAt: "2026-09-30T10:00:00Z" }),
  t("deleted-but-active-flag", { nextDue: REF, active: true, deletedAt: "2026-09-30T10:00:00Z" }),
];

function setup(candidates: Tenner[] = mixed, now = new Date("2026-10-01T08:00:00Z"), timezone = "Europe/Berlin") {
  const repository = mockTennerRepository();
  repository.getDashboardCandidates.mockResolvedValue(candidates);
  repository.list.mockResolvedValue([]);
  return { repository, service: new DashboardService(repository, () => now, async () => timezone, async () => null) };
}

const ids = (items: { tennerId: string }[]) => items.map((i) => i.tennerId);

describe("DashboardService", () => {
  it("builds the dashboard from mixed Tenners with one repository call", async () => {
    const { repository, service } = setup();
    const dashboard = await service.getDashboard("default", { date: REF });

    expect(repository.getDashboardCandidates).toHaveBeenCalledOnce();
    expect(repository.getDashboardCandidates).toHaveBeenCalledWith("default", "2026-10-08");
    expect(dashboard.referenceDate).toBe(REF);
    expect(dashboard.timezone).toBe("Europe/Berlin");
    expect(ids(dashboard.dueToday)).toEqual(["due-c", "due-a", "due-b"]);
    expect(ids(dashboard.overdue)).toEqual(["over-2", "over-1"]);
    expect(ids(dashboard.upcoming)).toEqual(["up-3", "up-1", "up-2"]);
  });

  it("classifies sections with day counts and excludes eight-days-away, inactive and deleted Tenners", async () => {
    const { service } = setup();
    const dashboard = await service.getDashboard("default", { date: REF });
    const all = [...ids(dashboard.dueToday), ...ids(dashboard.overdue), ...ids(dashboard.upcoming)];
    expect(all).not.toContain("eight-days");
    expect(all).not.toContain("inactive");
    expect(all).not.toContain("deleted");
    expect(all).not.toContain("deleted-but-active-flag");
    expect(dashboard.overdue.map((i) => i.overdueDays)).toEqual([11, 3]);
    expect(dashboard.upcoming.map((i) => i.daysUntilDue)).toEqual([3, 3, 7]);
    expect(dashboard.dueToday[0]).toEqual({ tennerId: "due-c", title: "Water Plants", category: "HOME", assignedTo: "STEFAN", estimatedMinutes: 5, nextDue: REF, snoozedUntil: null });
    expect(dashboard.dueToday[0]).not.toHaveProperty("overdueDays");
  });

  it("calculates summary, actionable totals, user and category summaries (actionable only)", async () => {
    const { service } = setup();
    const dashboard = await service.getDashboard("default", { date: REF });
    expect(dashboard.summary).toEqual({
      dueTodayCount: 3,
      overdueCount: 2,
      upcomingCount: 3,
      dueTodayMinutes: 25,
      overdueMinutes: 35,
      upcomingMinutes: 60,
      totalActionableCount: 5,
      totalActionableMinutes: 60,
    });
    expect(dashboard.byUser).toEqual({ STEFAN: { count: 3, estimatedMinutes: 30 }, JULIA: { count: 2, estimatedMinutes: 30 } });
    expect(dashboard.byCategory).toEqual({
      HOUSEHOLD: { count: 1, estimatedMinutes: 10 },
      FITNESS: { count: 1, estimatedMinutes: 10 },
      HOME: { count: 3, estimatedMinutes: 40 },
    });
  });

  it("applies the assigned user filter to all sections", async () => {
    const { service } = setup();
    const dashboard = await service.getDashboard("default", { date: REF, assignedTo: "JULIA" });
    expect(ids(dashboard.dueToday)).toEqual(["due-a"]);
    expect(ids(dashboard.overdue)).toEqual(["over-2"]);
    expect(ids(dashboard.upcoming)).toEqual(["up-1"]);
    expect(Object.keys(dashboard.byUser)).toEqual(["JULIA"]);
  });

  it("applies the category filter and combined filters", async () => {
    const { service } = setup();
    const home = await service.getDashboard("default", { date: REF, category: "HOME" });
    expect(ids(home.dueToday)).toEqual(["due-c"]);
    expect(ids(home.overdue)).toEqual(["over-2", "over-1"]);
    const combined = await service.getDashboard("default", { date: REF, category: "HOME", assignedTo: "STEFAN" });
    expect([...ids(combined.dueToday), ...ids(combined.overdue), ...ids(combined.upcoming)]).toEqual(["due-c", "over-1"]);
  });

  it("returns an empty dashboard", async () => {
    const { service } = setup([]);
    const dashboard = await service.getDashboard("default", { date: REF });
    expect(dashboard).toEqual({
      referenceDate: REF,
      timezone: "Europe/Berlin",
      summary: { dueTodayCount: 0, overdueCount: 0, upcomingCount: 0, dueTodayMinutes: 0, overdueMinutes: 0, upcomingMinutes: 0, totalActionableCount: 0, totalActionableMinutes: 0 },
      dueToday: [],
      overdue: [],
      upcoming: [],
      paused: [],
      byUser: {},
      byCategory: {},
    });
  });

  it("uses an explicit reference date, including future dates", async () => {
    const { repository, service } = setup([]);
    const dashboard = await service.getDashboard("default", { date: "2027-01-15" });
    expect(dashboard.referenceDate).toBe("2027-01-15");
    expect(repository.getDashboardCandidates).toHaveBeenCalledWith("default", "2027-01-22");
  });

  it.each([
    ["default date = Berlin today when UTC is still yesterday", "2026-09-30T22:30:00Z", "2026-10-01", "2026-10-08"],
    ["DST transition", "2026-03-28T23:30:00Z", "2026-03-29", "2026-04-05"],
    ["end of month", "2026-04-30T22:15:00Z", "2026-05-01", "2026-05-08"],
    ["end of year", "2026-12-31T23:30:00Z", "2027-01-01", "2027-01-08"],
    ["leap year", "2028-02-28T23:30:00Z", "2028-02-29", "2028-03-07"],
  ])("resolves the default reference date in the application timezone: %s", async (_name, now, reference, end) => {
    const { repository, service } = setup([], new Date(now));
    expect((await service.getDashboard("default")).referenceDate).toBe(reference);
    expect(repository.getDashboardCandidates).toHaveBeenCalledWith("default", end);
  });

  it("uses the configured timezone", async () => {
    const { service } = setup([], new Date("2026-07-15T02:00:00Z"), "America/New_York");
    const dashboard = await service.getDashboard("default");
    expect(dashboard).toMatchObject({ referenceDate: "2026-07-14", timezone: "America/New_York" });
  });

  it("propagates repository failures", async () => {
    const { repository, service } = setup();
    repository.getDashboardCandidates.mockRejectedValue(new PersistenceError());
    await expect(service.getDashboard("default", { date: REF })).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("dashboardHandler", () => {
  const event = (query?: Record<string, string>) => ({ queryStringParameters: query }) as unknown as APIGatewayProxyEventV2;

  it("logs the structured dashboard event", async () => {
    const logger = mockLogger();
    const { service } = setup();
    let clock = 100;
    const response = await dashboardHandler(event({ date: REF }), "default", (tenant, req) => service.getDashboard(tenant, req), logger, () => (clock += 4));
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(
      "Dashboard requested",
      expect.objectContaining({ event: "DashboardServed", referenceDate: REF, dueTodayCount: 3, overdueCount: 2, upcomingCount: 3, actionableCount: 5, totalActionableMinutes: 60, durationMs: 4 }),
    );
  });

  it("logs failures and rethrows", async () => {
    const logger = mockLogger();
    const error = new PersistenceError();
    await expect(dashboardHandler(event(), "default", vi.fn().mockRejectedValue(error), logger)).rejects.toBe(error);
    expect(logger.warn).toHaveBeenCalledWith("Dashboard failed", expect.objectContaining({ event: "DashboardFailed", errorCode: "PERSISTENCE_ERROR" }));
    await expect(dashboardHandler(event(), "default", vi.fn().mockRejectedValue(new Error("x")), logger)).rejects.toThrow("x");
    expect(logger.warn).toHaveBeenLastCalledWith("Dashboard failed", expect.objectContaining({ errorCode: "INTERNAL_ERROR" }));
  });

  it.each([
    ["invalid user", { assignedTo: "BOB" }],
    ["invalid category", { category: "GARDEN" }],
    ["invalid date format", { date: "2026/10/01" }],
    ["invalid calendar date", { date: "2026-02-30" }],
  ])("rejects %s with 'Invalid dashboard query.'", async (_name, query) => {
    const getDashboard = vi.fn();
    const error = await dashboardHandler(event(query), "default", getDashboard, mockLogger()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toBe("Invalid dashboard query.");
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
