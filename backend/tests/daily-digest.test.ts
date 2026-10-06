/** NOTIFICATION-003: daily digest. */

import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse, DashboardTennerResponse } from "../src/dto/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "../src/models/index.js";
import { DIGEST_ITEM_LIMIT, LogChannel, dailyDigestJob, renderDigest, runNotifier, type DeliveryLog, type Recipient } from "../src/notifications/index.js";
import { mockLogger } from "./mocks/index.js";

const RECIPIENT: Recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
const AT_0730 = new Date("2026-10-06T05:30:00Z"); // 07:30 Berlin

const item = (title: string, overrides: Partial<DashboardTennerResponse> = {}): DashboardTennerResponse => ({
  tennerId: title,
  title,
  category: "HOUSEHOLD",
  assignedTo: "STEFAN",
  originalAssignee: null,
  estimatedMinutes: 10,
  nextDue: "2026-10-06",
  snoozedUntil: null,
  ...overrides,
});

function dashboard(dueToday: DashboardTennerResponse[], overdue: DashboardTennerResponse[] = []): DashboardResponse {
  const sum = (list: DashboardTennerResponse[]) => list.reduce((total, tenner) => total + tenner.estimatedMinutes, 0);
  return {
    referenceDate: "2026-10-06",
    timezone: "Europe/Berlin",
    summary: {
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      upcomingCount: 0,
      dueTodayMinutes: sum(dueToday),
      overdueMinutes: sum(overdue),
      upcomingMinutes: 0,
      totalActionableCount: dueToday.length + overdue.length,
      totalActionableMinutes: sum(dueToday) + sum(overdue),
    },
    dueToday,
    overdue,
    upcoming: [],
    paused: [],
    byUser: {},
    byCategory: {},
  };
}

const DAY = dashboard([item("Büro saugen"), item("Mobility", { estimatedMinutes: 15 }), item("Spülmaschine", { assignedTo: "HOUSEHOLD", estimatedMinutes: 5 })], [item("Auto waschen", { overdueDays: 3 })]);

function job(preferences: Partial<NotificationPreferences> = {}, board: DashboardResponse = DAY) {
  const deps = {
    preferencesOf: vi.fn(async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences })),
    dashboard: vi.fn(async () => board),
    appUrl: "https://tenner.example",
  };
  return { job: dailyDigestJob(deps), deps };
}

describe("renderDigest", () => {
  it("renders today, overdue, minutes and the deep link (Digest Content Rendering)", () => {
    const message = renderDigest(DAY, RECIPIENT, 450, "https://tenner.example");
    expect(message?.textBody).toBe(
      ["Guten Morgen, Stefan ☀️", "", "Heute (3 Tenner · ~30 Min.)", "• Büro saugen", "• Mobility", "• Spülmaschine", "", "Überfällig (1)", "• Auto waschen — 3 Tage", "", "Tenner öffnen → https://tenner.example"].join("\n"),
    );
    expect(message).toMatchObject({ type: "DAILY_DIGEST", userId: "STEFAN", subject: "Heute: 3 Tenner · ~40 Min. · 1 überfällig", deepLink: "https://tenner.example", facts: { dueToday: 3, overdue: 1, minutes: 40 } });
  });

  it("skips empty days (Empty Day Skipped)", () => {
    expect(renderDigest(dashboard([]), RECIPIENT, 450, undefined)).toBeUndefined();
  });

  it("lists at most ten items per section (Item Limits)", () => {
    const many = Array.from({ length: 13 }, (_, index) => item(`T${index}`));
    const text = renderDigest(dashboard(many, [item("Alt", { overdueDays: 1 })]), RECIPIENT, 600, undefined)?.textBody ?? "";
    expect(text.split("\n").filter((line) => line.startsWith("• T"))).toHaveLength(DIGEST_ITEM_LIMIT);
    expect(text).toContain("+3 weitere");
    expect(text).toContain("• Alt — 1 Tag");
    expect(text).not.toContain("Tenner öffnen");
  });

  it("greets by local time", () => {
    expect(renderDigest(DAY, RECIPIENT, 12 * 60, undefined)?.textBody).toMatch(/^Guten Tag/);
    expect(renderDigest(DAY, RECIPIENT, 19 * 60, undefined)?.textBody).toMatch(/^Guten Abend/);
  });
});

describe("dailyDigestJob", () => {
  it("is due at the configured local time only (Timezone-Correct Send Time)", async () => {
    expect(await job().job.channelsDue(RECIPIENT, AT_0730)).toEqual(["LOG"]);
    expect(await job().job.channelsDue(RECIPIENT, new Date("2026-10-06T06:00:00Z"))).toEqual([]);
    expect(await job({ timezone: "Europe/London" }).job.channelsDue(RECIPIENT, new Date("2026-10-06T06:30:00Z"))).toEqual(["LOG"]);
    expect(await job({ dailyDigest: { enabled: true, time: "07:30", channels: ["ALEXA"] } }).job.channelsDue(RECIPIENT, AT_0730)).toEqual(["LOG", "ALEXA"]);
    expect(await job({ dailyDigest: { enabled: false, time: "07:30", channels: [] } }).job.channelsDue(RECIPIENT, AT_0730)).toEqual([]);
  });

  it("respects quiet hours (Quiet Hours)", async () => {
    const quiet = job({ dailyDigest: { enabled: true, time: "06:30", channels: [] }, quietHours: { start: "21:30", end: "07:00" } });
    expect(await quiet.job.channelsDue(RECIPIENT, new Date("2026-10-06T04:30:00Z"))).toEqual([]);
  });

  it("asks the dashboard for the member's own and shared Tenners (Assigned And Shared Tenners)", async () => {
    const { job: digest, deps } = job();
    const message = await digest.render(RECIPIENT, AT_0730);
    expect(deps.dashboard).toHaveBeenCalledWith("default", { assignedTo: "STEFAN" });
    expect(message?.textBody).toContain("• Spülmaschine");
  });

  it("sends once per day even when the notifier runs twice (Deduplication Per Day)", async () => {
    const records = new Set<string>();
    const log: DeliveryLog = {
      claim: async (record) => (records.has(record.notificationKey) ? false : (records.add(record.notificationKey), true)),
      complete: async () => undefined,
      has: async () => false,
      get: async () => undefined,
      mark: async () => undefined,
    };
    const logger = mockLogger();
    const deps = {
      tenantId: "default",
      members: async () => [{ userId: "STEFAN", displayName: "Stefan", color: "BLUE" as const, active: true, createdAt: "t", updatedAt: "t" }],
      timezoneOf: async () => "Europe/Berlin",
      jobs: [job().job],
      channels: [new LogChannel(logger)],
      log,
      logger,
      now: () => AT_0730,
    };
    expect((await runNotifier(deps)).deliveries.SENT).toBe(1);
    expect((await runNotifier({ ...deps, now: () => new Date("2026-10-06T05:40:00Z") })).deliveries).toEqual({ SENT: 0, FAILED: 0, SKIPPED: 1 });
    expect([...records]).toEqual(["default#STEFAN#DAILY_DIGEST#LOG#2026-10-06"]);
  });
});
