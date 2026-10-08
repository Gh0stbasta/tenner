/** NOTIFICATION-004: overdue alerts. */

import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse, DashboardTennerResponse } from "../src/dto/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "../src/models/index.js";
import { LogChannel, cycleKey, overdueAlertJob, renderAlert, runNotifier, type Recipient } from "../src/notifications/index.js";
import { memoryDeliveryLog } from "./mocks/delivery-log.js";
import { mockLogger } from "./mocks/index.js";

const RECIPIENT: Recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
const AT_1800 = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T16:00:00Z`); // 18:00 Berlin (NOTIFICATION-010 default)

const overdue = (title: string, overdueDays: number, nextDue = "2026-10-01"): DashboardTennerResponse => ({
  tennerId: title,
  title,
  category: "HOUSEHOLD",
  assignedTo: "STEFAN",
  originalAssignee: null,
  estimatedMinutes: 10,
  nextDue,
  snoozedUntil: null,
  overdueDays,
});

const board = (items: DashboardTennerResponse[]): DashboardResponse => ({
  referenceDate: "2026-10-06",
  timezone: "Europe/Berlin",
  summary: { dueTodayCount: 0, overdueCount: items.length, upcomingCount: 0, dueTodayMinutes: 0, overdueMinutes: 0, upcomingMinutes: 0, totalActionableCount: items.length, totalActionableMinutes: 0 },
  dueToday: [],
  overdue: items,
  upcoming: [],
  paused: [],
  byUser: {},
  byCategory: {},
});

function setup(items: () => DashboardTenner[], preferences: Partial<NotificationPreferences> = {}, frequencies: Record<string, number> = {}) {
  const { log, records } = memoryDeliveryLog();
  const dashboard = vi.fn(async () => board(items()));
  const job = overdueAlertJob({
    preferencesOf: async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences }),
    dashboard,
    frequencies: async () => new Map(Object.entries(frequencies)),
    log,
    appUrl: undefined,
  });
  const logger = mockLogger();
  const run = (now: Date) =>
    runNotifier({
      tenantId: "default",
      members: async () => [{ userId: "STEFAN", displayName: "Stefan", color: "BLUE", active: true, canSignIn: true, createdAt: "t", updatedAt: "t" }],
      timezoneOf: async () => "Europe/Berlin",
      jobs: [job],
      channels: [new LogChannel(logger)],
      log,
      logger,
      now: () => now,
    });
  const alerts = () => logger.info.mock.calls.filter(([message]) => message === "Notification (log channel)").map(([, fields]) => (fields as { subject: string }).subject);
  return { job, run, records, dashboard, alerts };
}

type DashboardTenner = DashboardTennerResponse;

describe("overdue alerts", () => {
  it("alerts at the threshold and not below it (Threshold Reached / Below Threshold)", async () => {
    const below = setup(() => [overdue("Fenster", 1)]);
    await below.run(AT_1800(6));
    expect(below.alerts()).toEqual([]);
    const reached = setup(() => [overdue("Fenster", 2)]);
    await reached.run(AT_1800(6));
    expect(reached.alerts()).toEqual(["Überfällig: 1 Aufgabe"]);
    expect(reached.dashboard).toHaveBeenCalledWith("default", { assignedTo: "STEFAN" });
  });

  it("bundles several Tenners into one message per day (Bundling Multiple Tenners)", async () => {
    const { run, alerts } = setup(() => [overdue("Fenster", 3), overdue("Altglas", 5)]);
    await run(AT_1800(6));
    expect(alerts()).toEqual(["Überfällig: 2 Aufgaben"]);
  });

  it("alerts a Tenner only once per cycle (Once Per Cycle)", async () => {
    let days = 3;
    const { run, alerts, records } = setup(() => [overdue("Fenster", days)], {}, { Fenster: 7 });
    await run(AT_1800(6));
    days = 4;
    await run(AT_1800(7));
    expect(alerts()).toEqual(["Überfällig: 1 Aufgabe"]);
    expect(records.has(cycleKey(RECIPIENT, { tennerId: "Fenster", nextDue: "2026-10-01" }))).toBe(true);
  });

  it("sends one reminder after twice the frequency, then none (Escalation Reminder)", async () => {
    let days = 3;
    const { run, alerts } = setup(() => [overdue("Fenster", days)], {}, { Fenster: 7 });
    await run(AT_1800(6));
    days = 14;
    await run(AT_1800(17));
    days = 20;
    await run(AT_1800(23));
    expect(alerts()).toEqual(["Überfällig: 1 Aufgabe", "Überfällig: 1 Aufgabe"]);
  });

  it("starts a new cycle after completion (Completion Resets Cycle)", async () => {
    let item = overdue("Fenster", 3, "2026-10-01");
    const { run, alerts } = setup(() => [item]);
    await run(AT_1800(4));
    item = overdue("Fenster", 2, "2026-10-08"); // completed; the next occurrence became overdue again
    await run(AT_1800(10));
    expect(alerts()).toHaveLength(2);
  });

  it("ignores snoozed Tenners because the dashboard does not list them as overdue (Snoozed Tenner Ignored)", async () => {
    const { run, alerts } = setup(() => []);
    await run(AT_1800(6));
    expect(alerts()).toEqual([]);
  });

  it("runs only in the evening window, when enabled and outside quiet hours", async () => {
    const { job } = setup(() => [overdue("Fenster", 3)]);
    expect(await job.channelsDue(RECIPIENT, AT_1800(6))).toEqual(["LOG"]);
    expect(await job.channelsDue(RECIPIENT, new Date("2026-10-06T05:30:00Z"))).toEqual([]);
    expect(await setup(() => [], { overdueAlerts: { enabled: false, minDaysOverdue: 2, time: "18:00", channels: [] } }).job.channelsDue(RECIPIENT, AT_1800(6))).toEqual([]);
    expect(await setup(() => [], { quietHours: { start: "17:00", end: "19:00" } }).job.channelsDue(RECIPIENT, AT_1800(6))).toEqual([]);
  });

  it("renders the bundle with days, reminder label and link", () => {
    const message = renderAlert([{ tenner: overdue("Fenster", 1), escalation: false }, { tenner: overdue("Altglas", 14), escalation: true }], RECIPIENT, "https://tenner.example");
    expect(message.textBody).toBe(["Stefan, 2 Aufgaben sind überfällig:", "• Fenster — 1 Tag", "• Altglas — 14 Tage (Erinnerung)", "", "Zentrale öffnen → https://tenner.example"].join("\n"));
    expect(message.facts).toEqual({ overdue: 2, oldestDays: 14 });
    expect(renderAlert([{ tenner: overdue("Fenster", 3), escalation: false }], RECIPIENT, undefined).textBody).toBe("Stefan, eine Aufgabe ist überfällig:\n• Fenster — 3 Tage");
  });
});

describe("alert items and evening time (NOTIFICATION-010)", () => {
  it("lists each alerted Tenner with its overdue days and cycle", () => {
    const message = renderAlert([{ tenner: overdue("Fenster", 4, "2026-10-02"), escalation: false }], RECIPIENT, undefined);
    expect(message.items).toEqual([{ tennerId: "Fenster", title: "Fenster", estimatedMinutes: 10, overdueDays: 4, nextDue: "2026-10-02" }]);
  });

  it("uses the member's alert time", async () => {
    const { job } = setup(() => [], { overdueAlerts: { enabled: true, minDaysOverdue: 2, time: "20:00", channels: ["WEB_PUSH"] } });
    expect(await job.channelsDue(RECIPIENT, AT_1800(6))).toEqual([]);
    expect(await job.channelsDue(RECIPIENT, new Date("2026-10-06T18:00:00Z"))).toEqual(["LOG", "WEB_PUSH"]);
  });
});
