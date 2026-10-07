/** NOTIFICATION-011: push notification actions (signed links), snooze times and snoozed reminders. */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse, DashboardTennerResponse } from "../src/dto/index.js";
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from "../src/exceptions/index.js";
import { pushActionHandler } from "../src/handlers/notification-preferences.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, SEED_MEMBERS, type HouseholdSettings, type NotificationPreferences, type PushSnooze } from "../src/models/index.js";
import { snoozedReminderJob, type NotificationMessage } from "../src/notifications/index.js";
import { InvalidActionTokenError, signActionToken, verifyActionToken, withActions, WebPushChannel, type PushOutcome } from "../src/push/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { CompleteTennerService, PushActionService, PushSnoozeService, remindAt } from "../src/services/index.js";
import { localDateTimeToInstant } from "../src/utils/timezone.js";
import { householdSettings, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const SECRET = "test-secret-0123456789abcdef";
const NOW = new Date("2026-10-07T06:00:00Z"); // 08:00 Berlin
const CLAIMS = { tenantId: "default", userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-07", action: "DONE" as const };

describe("action tokens", () => {
  it("round-trips the claims with a 24-hour expiry", () => {
    const token = signActionToken(CLAIMS, SECRET, NOW, "id-1");
    expect(verifyActionToken(token, SECRET, NOW)).toEqual({ ...CLAIMS, exp: Math.floor(NOW.getTime() / 1000) + 86400, id: "id-1" });
    expect(signActionToken(CLAIMS, SECRET, NOW)).not.toBe(signActionToken(CLAIMS, SECRET, NOW));
  });

  it("rejects other secrets, tampering, expiry and garbage", () => {
    const token = signActionToken(CLAIMS, SECRET, NOW);
    const reason = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof InvalidActionTokenError ? error.reason : "OTHER";
      }
      return "VALID";
    };
    expect(reason(() => verifyActionToken(token, "other-secret", NOW))).toBe("SIGNATURE");
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload ?? "", "base64url").toString()), tennerId: "t-2" })).toString("base64url");
    expect(reason(() => verifyActionToken(`${forged}.${signature}`, SECRET, NOW))).toBe("SIGNATURE");
    expect(reason(() => verifyActionToken(token, SECRET, new Date(NOW.getTime() + 86_401_000)))).toBe("EXPIRED");
    expect(reason(() => verifyActionToken("abc", SECRET, NOW))).toBe("MALFORMED");
    expect(reason(() => verifyActionToken("a.b.c", SECRET, NOW))).toBe("MALFORMED");
    const bad = Buffer.from(JSON.stringify({ ...CLAIMS, action: "DELETE", exp: 9e9, id: "x" })).toString("base64url");
    expect(reason(() => verifyActionToken(`${bad}.${createHmac("sha256", SECRET).update(bad).digest("base64url")}`, SECRET, NOW))).toBe("MALFORMED");
  });
});

describe("snooze times", () => {
  const prefs = (pushSnooze: NotificationPreferences["pushSnooze"]): NotificationPreferences => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, pushSnooze });

  it("converts local time to the instant, also across DST", () => {
    expect(localDateTimeToInstant("2026-10-07", "18:00", "Europe/Berlin").toISOString()).toBe("2026-10-07T16:00:00.000Z");
    expect(localDateTimeToInstant("2026-11-07", "08:00", "Europe/Berlin").toISOString()).toBe("2026-11-07T07:00:00.000Z");
    expect(localDateTimeToInstant("2026-10-25", "08:00", "Europe/Berlin").toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });

  it("reminds in an hour, this evening (or in an hour after it) and tomorrow morning", () => {
    expect(remindAt(prefs("1H"), "Europe/Berlin", NOW).toISOString()).toBe("2026-10-07T07:00:00.000Z");
    expect(remindAt(prefs("EVENING"), "Europe/Berlin", NOW).toISOString()).toBe("2026-10-07T16:00:00.000Z");
    expect(remindAt(prefs("EVENING"), "Europe/Berlin", new Date("2026-10-07T17:00:00Z")).toISOString()).toBe("2026-10-07T18:00:00.000Z");
    expect(remindAt(prefs("TOMORROW"), "Europe/Berlin", NOW).toISOString()).toBe("2026-10-08T06:00:00.000Z");
  });
});

describe("CompleteTennerService expectedNextDue", () => {
  it("completes only the expected cycle", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tennerFixture({ tennerId: "t-1", nextDue: "2026-10-08" }));
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => NOW, () => "c-1", async () => "Europe/Berlin");
    await expect(service.completeTenner(TEST_IDENTITY, "t-1", {}, "k", { expectedNextDue: "2026-10-07" })).rejects.toMatchObject({ code: "TENNER_CYCLE_CHANGED" });
    expect(tenners.completeTenner).not.toHaveBeenCalled();
  });
});

function households(snoozes: PushSnooze[] = []) {
  let settings: HouseholdSettings = householdSettings({ pushSnoozes: snoozes, pushSnoozesVersion: snoozes.length });
  return {
    get current() {
      return settings;
    },
    get: vi.fn(async () => settings),
    savePushSnoozes: vi.fn<(tenantId: string, list: readonly PushSnooze[], expected: number, actor: string, timestamp: string) => Promise<HouseholdSettings>>(async (_tenantId, list, expected) => {
      settings = { ...settings, pushSnoozes: list, pushSnoozesVersion: expected + 1 };
      return settings;
    }),
  };
}

function actionService(overrides: { complete?: () => Promise<never>; members?: typeof SEED_MEMBERS; pushSnooze?: NotificationPreferences["pushSnooze"] } = {}) {
  const repo = households([{ userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-06", remindAt: "x", createdAt: "x" }]);
  const complete = vi.fn(overrides.complete ?? (async () => ({ response: { tenner: { title: "Kleines Bad" } }, replayed: false }) as never));
  const service = new PushActionService({
    secret: async () => SECRET,
    membersOf: async () => overrides.members ?? SEED_MEMBERS,
    preferencesOf: async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, pushSnooze: overrides.pushSnooze ?? "1H" }),
    timezoneOf: async () => "Europe/Berlin",
    complete,
    households: repo,
    clock: () => NOW,
  });
  return { service, complete, repo };
}

describe("PushActionService", () => {
  it("„Erledigt“ completes the cycle of the token as the member", async () => {
    const { service, complete } = actionService();
    const result = await service.handle(signActionToken(CLAIMS, SECRET, NOW, "id-1"));
    expect(result).toEqual({ action: "DONE", result: "COMPLETED", title: "Kleines Bad" });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "default", userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-07", id: "id-1" }));
  });

  it("answers ALREADY_DONE when the cycle moved on", async () => {
    const { service } = actionService({ complete: async () => Promise.reject(new ConflictError("x", "TENNER_CYCLE_CHANGED")) });
    expect(await service.handle(signActionToken(CLAIMS, SECRET, NOW))).toEqual({ action: "DONE", result: "ALREADY_DONE", title: null });
    const other = actionService({ complete: async () => Promise.reject(new ConflictError("x", "TENNER_INACTIVE")) });
    await expect(other.service.handle(signActionToken(CLAIMS, SECRET, NOW))).rejects.toMatchObject({ code: "TENNER_INACTIVE" });
  });

  it("rejects invalid tokens (401) and inactive or unknown members (403)", async () => {
    await expect(actionService().service.handle("abc.def")).rejects.toBeInstanceOf(UnauthorizedError);
    const inactive = actionService({ members: [{ ...SEED_MEMBERS[0], active: false } as (typeof SEED_MEMBERS)[number]] });
    await expect(inactive.service.handle(signActionToken(CLAIMS, SECRET, NOW))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(actionService().service.handle(signActionToken({ ...CLAIMS, userId: "KIM" }, SECRET, NOW))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("„Später“ stores one snooze per member and Tenner at the chosen time", async () => {
    const { service, repo } = actionService({ pushSnooze: "EVENING" });
    expect(await service.handle(signActionToken({ ...CLAIMS, action: "SNOOZE" }, SECRET, NOW))).toEqual({ action: "SNOOZE", result: "SNOOZED", remindAt: "2026-10-07T16:00:00Z" });
    expect(repo.current.pushSnoozes).toEqual([{ userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-07", remindAt: "2026-10-07T16:00:00Z", createdAt: "2026-10-07T06:00:00Z" }]);
    expect(repo.savePushSnoozes).toHaveBeenCalledWith("default", expect.any(Array), 1, "STEFAN", "2026-10-07T06:00:00Z");
  });
});

describe("pushActionHandler", () => {
  const event = (body: unknown) => ({ body: JSON.stringify(body), isBase64Encoded: false }) as unknown as APIGatewayProxyEventV2;

  it("handles the token and logs only action and result", async () => {
    const logger = mockLogger();
    const token = signActionToken(CLAIMS, SECRET, NOW);
    const handle = vi.fn(async () => ({ action: "DONE" as const, result: "COMPLETED" as const, title: "Bad" }));
    const response = await pushActionHandler(event({ token }), handle, logger);
    expect(JSON.parse(response.body ?? "").data).toEqual({ action: "DONE", result: "COMPLETED", title: "Bad" });
    expect(handle).toHaveBeenCalledWith(token);
    expect(logger.info).toHaveBeenCalledWith("Push action", { event: "PushAction", action: "DONE", result: "COMPLETED" });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(token);
  });

  it("rejects bodies without a token-shaped value", async () => {
    await expect(pushActionHandler(event({ token: "no dots" }), vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
    await expect(pushActionHandler(event({ token: "a.b", extra: 1 }), vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("push buttons", () => {
  const recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
  const item = { tennerId: "t-1", title: "Kleines Bad", estimatedMinutes: 10, nextDue: "2026-10-07" };

  it("adds „Erledigt“ and „Später“ with tokens for this member, Tenner and cycle", async () => {
    const sign = vi.fn(async (claims: { action: string }) => `token-${claims.action}`);
    const payload = await withActions({ title: "🏠 Tenner", body: "b", url: "u", tag: "tenner-t-1", tennerId: "t-1" }, item, recipient, { apiUrl: "https://api.example/prod", sign });
    expect(payload).toMatchObject({
      actionUrl: "https://api.example/prod/push-actions",
      actions: [
        { action: "done", title: "✅ Erledigt", token: "token-DONE" },
        { action: "snooze", title: "⏰ Später", token: "token-SNOOZE" },
      ],
    });
    expect(sign).toHaveBeenCalledWith({ tenantId: "default", userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-07", action: "DONE" });
  });

  it("the channel signs once per Tenner and sends the buttons to every device", async () => {
    const send = vi.fn<(subscription: unknown, payload: unknown) => Promise<PushOutcome>>(async () => ({ ok: true }));
    const sign = vi.fn(async () => "tok");
    const device = (n: number) => ({ userId: "STEFAN", endpoint: `https://push.example/${n}`, p256dh: "p", auth: "a", createdAt: "t" });
    const channel = new WebPushChannel({
      subscriptionsOf: async () => [device(1), device(2)],
      removeGone: vi.fn(),
      vapidKeys: async () => ({ publicKey: "p", privateKey: "k", subject: "s" }),
      appUrl: "https://app",
      now: () => NOW,
      send,
      actions: { apiUrl: "https://api", sign },
    });
    const message: NotificationMessage = { type: "DAILY_DIGEST", userId: "STEFAN", subject: "x", textBody: "x", items: [item] };
    expect(await channel.send(message, recipient)).toEqual({ status: "SENT" });
    expect(sign).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[1]).toMatchObject({ tennerId: "t-1", actions: [{ token: "tok" }, { token: "tok" }] });
  });
});

describe("snoozed reminders", () => {
  const tenner = (id: string, nextDue: string, overdueDays?: number): DashboardTennerResponse =>
    ({ tennerId: id, title: `Tenner ${id}`, estimatedMinutes: 10, nextDue, ...(overdueDays === undefined ? {} : { overdueDays }) }) as DashboardTennerResponse;
  const board = (dueToday: DashboardTennerResponse[], overdue: DashboardTennerResponse[] = []) => ({ dueToday, overdue }) as unknown as DashboardResponse;
  const recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
  const snooze = (tennerId: string, remind: string, nextDue = "2026-10-07"): PushSnooze => ({ userId: "STEFAN", tennerId, nextDue, remindAt: remind, createdAt: "t" });

  function job(snoozes: PushSnooze[], dashboard: DashboardResponse, preferences: Partial<NotificationPreferences> = {}) {
    const removeSnoozes = vi.fn(async () => undefined);
    return {
      removeSnoozes,
      job: snoozedReminderJob({
        snoozesOf: async () => snoozes,
        removeSnoozes,
        preferencesOf: async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences }),
        dashboard: async () => dashboard,
      }),
    };
  }

  it("is due once a snooze time passed, outside quiet hours, push only", async () => {
    const { job: due } = job([snooze("t-1", "2026-10-07T07:00:00Z")], board([tenner("t-1", "2026-10-07")]));
    expect(await due.channelsDue(recipient, NOW)).toEqual([]);
    expect(await due.channelsDue(recipient, new Date("2026-10-07T07:00:00Z"))).toEqual(["WEB_PUSH"]);
    const { job: quiet } = job([snooze("t-1", "2026-10-07T07:00:00Z")], board([]), { quietHours: { start: "08:00", end: "12:00" } });
    expect(await quiet.channelsDue(recipient, new Date("2026-10-07T07:15:00Z"))).toEqual([]);
  });

  it("re-sends Tenners still in the same cycle, drops stale snoozes and removes delivered ones", async () => {
    const snoozes = [snooze("t-1", "2026-10-07T07:00:00Z"), snooze("t-2", "2026-10-07T07:00:00Z"), snooze("t-3", "2026-10-07T07:00:00Z", "2026-10-01")];
    const { job: reminder, removeSnoozes } = job(snoozes, board([tenner("t-1", "2026-10-07")], [tenner("t-3", "2026-10-03", 4)]));
    const at = new Date("2026-10-07T07:05:00Z");
    const message = await reminder.render(recipient, at);
    expect(message?.items).toEqual([{ tennerId: "t-1", title: "Tenner t-1", estimatedMinutes: 10, nextDue: "2026-10-07" }]);
    expect(removeSnoozes).toHaveBeenCalledWith("default", [snoozes[1], snoozes[2]]);
    expect(reminder.dedupSuffix?.(message as NotificationMessage)).toBe("t-1@2026-10-07T07:00:00Z");
    await reminder.onDelivered?.(message as NotificationMessage, recipient, at);
    expect(removeSnoozes).toHaveBeenLastCalledWith("default", [snoozes[0]]);
  });

  it("marks overdue Tenners as overdue and renders nothing when all are done", async () => {
    const overdue = await job([snooze("t-3", "2026-10-07T07:00:00Z", "2026-10-03")], board([], [tenner("t-3", "2026-10-03", 4)])).job.render(recipient, new Date("2026-10-07T07:05:00Z"));
    expect(overdue?.items?.[0]?.overdueDays).toBe(4);
    expect(await job([snooze("t-9", "2026-10-07T07:00:00Z")], board([])).job.render(recipient, new Date("2026-10-07T07:05:00Z"))).toBeUndefined();
  });
});

describe("PushSnoozeService and storage", () => {
  it("removes matching snoozes only and skips writes when nothing matches", async () => {
    const a = { userId: "STEFAN", tennerId: "t-1", nextDue: "d", remindAt: "r1", createdAt: "c" };
    const b = { ...a, tennerId: "t-2" };
    const repo = households([a, b]);
    const service = new PushSnoozeService(repo, () => NOW);
    expect(await service.snoozesOf("default")).toEqual([a, b]);
    await service.remove("default", [a]);
    expect(repo.current.pushSnoozes).toEqual([b]);
    await service.remove("default", [a]);
    expect(repo.savePushSnoozes).toHaveBeenCalledTimes(1);
  });

  it("reads stored snoozes and drops malformed entries", async () => {
    const stored = { userId: "STEFAN", tennerId: "t-1", nextDue: "2026-10-07", remindAt: "2026-10-07T07:00:00Z", createdAt: "c" };
    const client = { send: vi.fn(async () => ({ Item: { tenantId: "default", pushSnoozes: [stored, { ...stored, userId: "x y" }, 5], pushSnoozesVersion: 2 } })) };
    const settings = await new DynamoDbHouseholdRepository(client, "t").get("default");
    expect(settings?.pushSnoozes).toEqual([stored]);
    expect(settings?.pushSnoozesVersion).toBe(2);
  });
});
