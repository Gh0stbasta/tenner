/** NOTIFICATION-001: notifier foundation. */

import type { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { SEED_MEMBERS, type HouseholdMember } from "../src/models/index.js";
import {
  ATTEMPTS_PER_RUN,
  LogChannel,
  deliver,
  inQuietHours,
  isDueAt,
  localTime,
  notificationKey,
  runNotifier,
  type DeliveryLog,
  type DeliveryRecord,
  type NotificationChannel,
  type NotificationJob,
  type NotificationMessage,
  type Recipient,
} from "../src/notifications/index.js";
import { createNotifierRuntime, NotifierNotConfiguredError } from "../src/notifier.js";
import { DynamoDbDeliveryLog } from "../src/repositories/index.js";
import { memoryDeliveryLog } from "./mocks/delivery-log.js";
import { mockLogger, testConfig } from "./mocks/index.js";

const NOW = new Date("2026-10-06T05:30:10Z"); // 07:30 in Berlin
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: false, canSignIn: true, createdAt: "t", updatedAt: "t" };

const message = (userId: string): NotificationMessage => ({ type: "DAILY_DIGEST", userId, subject: "Heute", textBody: "3 Tenner" });

/** Test job: due at 07:30 local, LOG channel. */
function digestJob(overrides: Partial<NotificationJob> = {}): NotificationJob {
  return {
    type: "DAILY_DIGEST",
    channelsDue: async (recipient, now) => (isDueAt("07:30", now, recipient.timezone) ? ["LOG"] : []),
    render: async (recipient) => message(recipient.userId),
    ...overrides,
  };
}

function setup(overrides: { jobs?: NotificationJob[]; channels?: NotificationChannel[]; now?: Date } = {}) {
  const { log, records } = memoryDeliveryLog();
  const logger = mockLogger();
  const deps = {
    tenantId: "default",
    members: async () => [...SEED_MEMBERS, LENA],
    timezoneOf: async () => "Europe/Berlin",
    jobs: overrides.jobs ?? [digestJob()],
    channels: overrides.channels ?? [new LogChannel(logger)],
    log,
    logger,
    now: () => overrides.now ?? NOW,
    sleep: vi.fn(async () => undefined),
  };
  return { deps, records, logger };
}

describe("schedule helpers", () => {
  it("selects jobs by local time in 15-minute windows (Job Selection By Time)", () => {
    expect(isDueAt("07:30", NOW, "Europe/Berlin")).toBe(true);
    expect(isDueAt("07:44", NOW, "Europe/Berlin")).toBe(true);
    expect(isDueAt("07:45", NOW, "Europe/Berlin")).toBe(false);
    expect(isDueAt("07:15", NOW, "Europe/Berlin")).toBe(false);
    expect(isDueAt("07:30", NOW, "UTC")).toBe(false);
    expect(localTime(NOW, "Europe/Berlin")).toEqual({ date: "2026-10-06", minutes: 450, weekday: 2 });
  });

  it("handles quiet hours across midnight", () => {
    const at = (iso: string) => new Date(iso);
    const quiet = { start: "21:30", end: "07:00" };
    expect(inQuietHours(quiet, at("2026-10-06T20:00:00Z"), "Europe/Berlin")).toBe(true); // 22:00
    expect(inQuietHours(quiet, at("2026-10-06T04:30:00Z"), "Europe/Berlin")).toBe(true); // 06:30
    expect(inQuietHours(quiet, NOW, "Europe/Berlin")).toBe(false); // 07:30
    expect(inQuietHours({ start: "12:00", end: "13:00" }, at("2026-10-06T10:30:00Z"), "Europe/Berlin")).toBe(true);
    expect(inQuietHours({ start: "12:00", end: "12:00" }, NOW, "Europe/Berlin")).toBe(false);
    expect(inQuietHours(null, NOW, "Europe/Berlin")).toBe(false);
  });

  it("builds deterministic keys", () => {
    expect(notificationKey({ tenantId: "default", userId: "STEFAN", type: "DAILY_DIGEST", channel: "LOG", date: "2026-10-06" })).toBe("default#STEFAN#DAILY_DIGEST#LOG#2026-10-06");
    expect(notificationKey({ tenantId: "t", userId: "U", type: "OVERDUE_ALERT", channel: "LOG", date: "d", suffix: "x#y" })).toBe("t#U#OVERDUE_ALERT#LOG#d#x#y");
  });
});

describe("runNotifier", () => {
  it("delivers due jobs to active members through the log channel (Log Channel Output)", async () => {
    const { deps, records, logger } = setup();
    const summary = await runNotifier(deps);
    expect(summary).toEqual({ recipients: 2, deliveries: { SENT: 2, FAILED: 0, SKIPPED: 0 }, errors: 0 });
    expect([...records.keys()]).toEqual(["default#STEFAN#DAILY_DIGEST#LOG#2026-10-06", "default#JULIA#DAILY_DIGEST#LOG#2026-10-06"]);
    expect(logger.info).toHaveBeenCalledWith("Notification (log channel)", { event: "NotificationLogged", type: "DAILY_DIGEST", userId: "STEFAN", subject: "Heute" });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("3 Tenner");
  });

  it("does not send twice when the notifier runs twice (Deduplication)", async () => {
    const { deps } = setup();
    await runNotifier(deps);
    expect((await runNotifier(deps)).deliveries).toEqual({ SENT: 0, FAILED: 0, SKIPPED: 2 });
  });

  it("skips jobs outside their time and empty messages", async () => {
    expect((await runNotifier(setup({ now: new Date("2026-10-06T08:00:00Z") }).deps)).deliveries.SENT).toBe(0);
    expect((await runNotifier(setup({ jobs: [digestJob({ render: async () => undefined })] }).deps)).deliveries.SENT).toBe(0);
  });

  it("isolates failing jobs, members and channels (Channel Failure Isolation)", async () => {
    const broken: NotificationChannel = { type: "ALEXA", send: vi.fn(async () => Promise.reject(new TypeError("boom"))) };
    const failingForStefan = digestJob({
      channelsDue: async () => ["LOG", "ALEXA"],
      render: async (recipient) => {
        if (recipient.userId === "STEFAN") throw new Error("render failed");
        return message(recipient.userId);
      },
    });
    const { deps, logger } = setup({ jobs: [failingForStefan], channels: [{ type: "LOG", send: async () => ({ status: "SENT" }) }, broken] });
    const summary = await runNotifier(deps);
    expect(summary).toEqual({ recipients: 2, deliveries: { SENT: 1, FAILED: 1, SKIPPED: 0 }, errors: 1 });
    expect(logger.error).toHaveBeenCalledWith("Notification job failed", expect.objectContaining({ userId: "STEFAN", error: "Error" }));
  });
});

describe("deliver", () => {
  const recipient: Recipient = { tenantId: "default", userId: "JULIA", displayName: "Julia", timezone: "Europe/Berlin" };

  it("retries up to three times with backoff, then records FAILED (Retry Behavior)", async () => {
    const { deps, records } = setup();
    const channel = { type: "LOG" as const, send: vi.fn(async () => ({ status: "FAILED" as const, errorCode: "HTTP_503" })) };
    const result = await deliver(deps, "k", message("JULIA"), recipient, channel);
    expect(result).toEqual({ status: "FAILED", errorCode: "HTTP_503" });
    expect(channel.send).toHaveBeenCalledTimes(ATTEMPTS_PER_RUN);
    expect(deps.sleep).toHaveBeenCalledTimes(ATTEMPTS_PER_RUN - 1);
    expect(records.get("k")).toMatchObject({ status: "FAILED", attempts: 3, errorCode: "HTTP_503" });
    // A later run may try again.
    channel.send.mockResolvedValueOnce({ status: "SENT" } as never);
    expect((await deliver(deps, "k", message("JULIA"), recipient, channel)).status).toBe("SENT");
    expect(records.get("k")).toMatchObject({ status: "SENT", attempts: 4 });
  });

  it("stops after a success and sets the TTL to 90 days (TTL Attribute Set)", async () => {
    const { deps, records } = setup();
    const channel = { type: "LOG" as const, send: vi.fn().mockResolvedValueOnce({ status: "FAILED" }).mockResolvedValueOnce({ status: "SENT" }) };
    await deliver(deps, "k", message("JULIA"), recipient, channel);
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(records.get("k")?.expiresAt).toBe(Math.floor(NOW.getTime() / 1000) + 90 * 86_400);
  });

  it("reports an unavailable delivery log without sending", async () => {
    const { deps } = setup();
    const send = vi.fn();
    const log: DeliveryLog = { claim: async () => Promise.reject(new Error("down")), complete: vi.fn(), has: vi.fn(), get: vi.fn(), mark: vi.fn() };
    expect(await deliver({ ...deps, log }, "k", message("JULIA"), recipient, { type: "LOG", send })).toEqual({ status: "FAILED", errorCode: "DELIVERY_LOG_UNAVAILABLE" });
    expect(send).not.toHaveBeenCalled();
  });

  it("still reports the result when recording the status fails", async () => {
    const { deps } = setup();
    const log: DeliveryLog = { claim: async () => true, complete: async () => Promise.reject(new Error("down")), has: vi.fn(), get: vi.fn(), mark: vi.fn() };
    expect((await deliver({ ...deps, log }, "k", message("JULIA"), recipient, { type: "LOG", send: async () => ({ status: "SENT" }) })).status).toBe("SENT");
    expect(deps.logger.error).toHaveBeenCalledWith("Notification status not recorded", expect.anything());
  });
});

describe("DynamoDbDeliveryLog", () => {
  const client = (send: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(send) });

  it("claims with a condition that allows only new or failed keys", async () => {
    const c = client(async () => ({}));
    const record: DeliveryRecord = { notificationKey: "k", type: "DAILY_DIGEST", channel: "LOG", userId: "U", status: "PENDING", attempts: 0, errorCode: null, createdAt: "t", expiresAt: 1 };
    expect(await new DynamoDbDeliveryLog(c, "tenner-notifications").claim(record)).toBe(true);
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      TableName: "tenner-notifications",
      Key: { notificationKey: "k" },
      ConditionExpression: "attribute_not_exists(#key) OR (#status = :failed AND #attempts < :maxAttempts)",
      ExpressionAttributeValues: expect.objectContaining({ ":expiresAt": 1, ":maxAttempts": 9 }),
    });
  });

  it("returns false on a conditional check failure and wraps other errors", async () => {
    const conditional = Object.assign(new Error("x"), { name: "ConditionalCheckFailedException" });
    const record = { notificationKey: "k" } as DeliveryRecord;
    expect(await new DynamoDbDeliveryLog(client(async () => Promise.reject(conditional)), "t").claim(record)).toBe(false);
    await expect(new DynamoDbDeliveryLog(client(async () => Promise.reject(new Error("x"))), "t").claim(record)).rejects.toThrow("Failed to claim notification.");
  });

  it("adds attempts when completing", async () => {
    const c = client(async () => ({}));
    await new DynamoDbDeliveryLog(c, "t").complete("k", "SENT", 2, null);
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({ UpdateExpression: "SET #status = :status, #errorCode = :errorCode ADD #attempts :attempts", ExpressionAttributeValues: { ":attempts": 2 } });
    await expect(new DynamoDbDeliveryLog(client(async () => Promise.reject(new Error("x"))), "t").complete("k", "SENT", 1, null)).rejects.toThrow("Failed to record notification status.");
  });
});

describe("DynamoDbDeliveryLog markers (NOTIFICATION-004)", () => {
  const client = (send: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(send) });

  it("checks existence with a key-only read and writes markers unconditionally", async () => {
    expect(await new DynamoDbDeliveryLog(client(async () => ({ Item: { notificationKey: "k" } })), "t").has("k")).toBe(true);
    expect(await new DynamoDbDeliveryLog(client(async () => ({ Item: { notificationKey: "k", status: "SENT", createdAt: "c" } })), "t").get("k")).toEqual({ notificationKey: "k", status: "SENT", createdAt: "c" });
    expect(await new DynamoDbDeliveryLog(client(async () => ({})), "t").has("k")).toBe(false);
    const c = client(async () => ({}));
    const record: DeliveryRecord = { notificationKey: "m", type: "OVERDUE_ALERT", channel: "ANY", userId: "U", status: "SENT", attempts: 0, errorCode: null, createdAt: "t", expiresAt: 5 };
    await new DynamoDbDeliveryLog(c, "t").mark(record);
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({ Key: { notificationKey: "m" }, ExpressionAttributeValues: { ":status": "SENT", ":expiresAt": 5 } });
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input.ConditionExpression).toBeUndefined();
  });

  it("wraps storage errors", async () => {
    const failing = new DynamoDbDeliveryLog(client(async () => Promise.reject(new Error("x"))), "t");
    await expect(failing.has("k")).rejects.toThrow("Failed to read notification.");
    await expect(failing.mark({ notificationKey: "m" } as DeliveryRecord)).rejects.toThrow("Failed to mark notification.");
  });
});

describe("createNotifierRuntime", () => {
  it("requires tables, the notifications table and the tenant", () => {
    expect(() => createNotifierRuntime(testConfig({ tables: undefined }))).toThrow(NotifierNotConfiguredError);
    expect(() => createNotifierRuntime(testConfig())).toThrow("NOTIFICATIONS_TABLE");
    expect(() => createNotifierRuntime(testConfig({ notificationsTable: "n", householdTenantId: undefined }))).toThrow("HOUSEHOLD_TENANT_ID");
    const runtime = createNotifierRuntime(testConfig({ notificationsTable: "tenner-notifications" }));
    expect(runtime.widget).toBeUndefined();
    const deps = runtime.notifier;
    expect(deps.tenantId).toBe("default");
    expect(deps.channels.map((channel) => channel.type)).toEqual(["LOG"]);
    expect(deps.jobs.map((job) => job.type)).toEqual(["DAILY_DIGEST", "OVERDUE_ALERT", "MEAL_TODAY"]);
    // FOOD-016: no meal job without the meals table.
    const withoutMeals = createNotifierRuntime(testConfig({ notificationsTable: "tenner-notifications", mealsTable: undefined }));
    expect(withoutMeals.notifier.jobs.map((job) => job.type)).toEqual(["DAILY_DIGEST", "OVERDUE_ALERT"]);
  });
});
