/** NOTIFICATION-002: notification preferences. */

import type { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/exceptions/index.js";
import { getNotificationPreferencesHandler, updateNotificationPreferencesHandler } from "../src/handlers/notification-preferences.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, withPreferenceDefaults, type HouseholdSettings, type NotificationPreferences } from "../src/models/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { NotificationPreferencesService } from "../src/services/index.js";
import { notificationPreferencesSchema, validate } from "../src/validators/index.js";
import { authenticatedEvent, householdSettings, mockLogger, TEST_IDENTITY } from "./mocks/index.js";

const CUSTOM: NotificationPreferences = {
  timezone: "Europe/Vienna",
  dailyDigest: { enabled: true, time: "06:45", channels: ["ALEXA"] },
  overdueAlerts: { enabled: false, minDaysOverdue: 5, time: "18:00", channels: [] },
  weeklySummary: { enabled: true, dayOfWeek: "SAT", time: "10:00", channels: [] },
  quietHours: { start: "22:00", end: "06:30" },
  pushSnooze: "EVENING",
  mealToday: { enabled: false, time: "07:15", channels: [] },
};

function world(settings: Partial<HouseholdSettings> | undefined = {}, connected: string[] = []) {
  let household: HouseholdSettings | undefined = settings === undefined ? undefined : householdSettings(settings);
  const households = {
    get: vi.fn(async () => household),
    saveNotificationPreferences: vi.fn(async (_tenantId: string, notificationPreferences: HouseholdSettings["notificationPreferences"], expectedVersion: number) => {
      const current = household ?? householdSettings();
      if (expectedVersion !== current.notificationPreferencesVersion) throw new ConflictError("changed", "CONCURRENT_MODIFICATION");
      household = { ...current, notificationPreferences, notificationPreferencesVersion: expectedVersion + 1 };
      return household;
    }),
  };
  const service = new NotificationPreferencesService(households, () => new Date("2026-10-06T08:00:00Z"), async () => "Europe/Berlin", async () => connected as never);
  return { service, households, household: () => household };
}

describe("NotificationPreferencesService", () => {
  it("returns the defaults with channel status (Default Preferences)", async () => {
    const result = await world(undefined).service.get(TEST_IDENTITY, "STEFAN");
    expect(result.preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(result.effectiveTimezone).toBe("Europe/Berlin");
    expect(result.channels).toEqual([
      { type: "ALEXA", connected: false },
      { type: "WEB_PUSH", connected: false },
    ]);
  });

  it("stores the member's preferences next to the others' (Update Preferences)", async () => {
    const w = world({ notificationPreferences: { JULIA: DEFAULT_NOTIFICATION_PREFERENCES }, notificationPreferencesVersion: 3 }, ["ALEXA"]);
    const result = await w.service.update(TEST_IDENTITY, "STEFAN", CUSTOM);
    expect(result.preferences).toEqual(CUSTOM);
    expect(result.effectiveTimezone).toBe("Europe/Vienna");
    expect(result.channels.find((channel) => channel.type === "ALEXA")?.connected).toBe(true);
    expect(w.household()?.notificationPreferences).toEqual({ JULIA: DEFAULT_NOTIFICATION_PREFERENCES, STEFAN: CUSTOM });
    expect(w.households.saveNotificationPreferences).toHaveBeenCalledWith("default", expect.anything(), 3, "STEFAN", "2026-10-06T08:00:00Z");
    expect(await w.service.preferencesOf("default", "STEFAN")).toEqual(CUSTOM);
    expect(await w.service.preferencesOf("default", "LENA")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("rejects channels that are not connected (Unconfigured Channel Rejected)", async () => {
    const error = await world({}, []).service.update(TEST_IDENTITY, "STEFAN", CUSTOM).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual([{ field: "channels", message: "Not connected: ALEXA." }]);
  });

  it("allows only the member themselves and known members", async () => {
    await expect(world().service.get(TEST_IDENTITY, "JULIA")).rejects.toThrow(ForbiddenError);
    await expect(world().service.update(TEST_IDENTITY, "JULIA", CUSTOM)).rejects.toThrow(ForbiddenError);
    await expect(world().service.get({ tenantId: "default", userId: "NOBODY" }, "NOBODY")).rejects.toThrow(NotFoundError);
  });
});

describe("notificationPreferencesSchema", () => {
  const body = (changes: Record<string, unknown>) => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...changes });

  it("accepts the defaults and an overnight quiet range (Quiet Hours Overnight Range)", () => {
    expect(validate(notificationPreferencesSchema, body({ quietHours: { start: "23:00", end: "06:00" } })).quietHours).toEqual({ start: "23:00", end: "06:00" });
    expect(validate(notificationPreferencesSchema, body({ quietHours: null })).quietHours).toBeNull();
  });

  it.each([
    ["time outside the 15-minute grid", { dailyDigest: { enabled: true, time: "07:10", channels: [] } }],
    ["invalid hour", { dailyDigest: { enabled: true, time: "24:00", channels: [] } }],
    ["minDaysOverdue above 30", { overdueAlerts: { enabled: true, minDaysOverdue: 31, channels: [] } }],
    ["unknown channel", { overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: ["SMS"] } }],
    ["LOG is not selectable", { overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: ["LOG"] } }],
    ["duplicate channels", { overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: ["ALEXA", "ALEXA"] } }],
    ["unknown weekday", { weeklySummary: { enabled: false, dayOfWeek: "SUNDAY", time: "18:00", channels: [] } }],
    ["invalid timezone", { timezone: "Mars/Olympus" }],
    ["unknown field", { extra: true }],
  ])("rejects %s (Invalid Time / Invalid Timezone)", (_name, changes) => {
    expect(() => validate(notificationPreferencesSchema, body(changes))).toThrow(ValidationError);
  });
});

describe("handlers", () => {
  const response = { preferences: DEFAULT_NOTIFICATION_PREFERENCES, channels: [], effectiveTimezone: "Europe/Berlin" };

  it("reads and updates by path user and logs no addresses", async () => {
    const get = vi.fn(async () => response);
    const event = authenticatedEvent({ pathParameters: { userId: "STEFAN" } });
    expect((await getNotificationPreferencesHandler(event, TEST_IDENTITY, get)).statusCode).toBe(200);
    const update = vi.fn(async () => response);
    const logger = mockLogger();
    const result = await updateNotificationPreferencesHandler({ ...event, body: JSON.stringify(CUSTOM) }, TEST_IDENTITY, update, logger);
    expect(result.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(TEST_IDENTITY, "STEFAN", CUSTOM);
    expect(logger.info).toHaveBeenCalledWith("Notification preferences changed", { event: "NotificationPreferencesChanged", userId: "STEFAN", dailyDigest: true, overdueAlerts: false, weeklySummary: true, mealToday: false });
  });
});

describe("DynamoDbHouseholdRepository (notificationPreferences)", () => {
  const client = (send: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(send) });

  it("reads valid entries only", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", notificationPreferencesVersion: 2, notificationPreferences: { STEFAN: CUSTOM, "bad id": CUSTOM, JULIA: "x", LENA: { dailyDigest: {} } } } }));
    const settings = await new DynamoDbHouseholdRepository(c, "t").get("default");
    expect(settings?.notificationPreferences).toEqual({ STEFAN: CUSTOM });
    expect(settings?.notificationPreferencesVersion).toBe(2);
    expect((await new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default" } })), "t").get("default"))?.notificationPreferences).toEqual({});
  });

  it("saves the map with optimistic locking", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", notificationPreferences: { STEFAN: CUSTOM }, notificationPreferencesVersion: 1 } }));
    await new DynamoDbHouseholdRepository(c, "t").saveNotificationPreferences("default", { STEFAN: CUSTOM }, 0, "STEFAN", "ts");
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      ConditionExpression: "attribute_not_exists(#version)",
      ExpressionAttributeNames: { "#list": "notificationPreferences", "#version": "notificationPreferencesVersion" },
    });
  });
});

describe("evening alert time (NOTIFICATION-010)", () => {
  it("gives stored preferences without a time the 18:00 default", () => {
    const stored = { ...DEFAULT_NOTIFICATION_PREFERENCES, overdueAlerts: { enabled: true, minDaysOverdue: 3, channels: [] } } as unknown as NotificationPreferences;
    expect(withPreferenceDefaults(stored).overdueAlerts).toEqual({ enabled: true, minDaysOverdue: 3, time: "18:00", channels: [] });
  });

  it("accepts a request without the time (older clients) and a quarter-hour time", () => {
    const body = { ...DEFAULT_NOTIFICATION_PREFERENCES, overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: [] } };
    expect(notificationPreferencesSchema.parse(body).overdueAlerts.time).toBe("18:00");
    expect(notificationPreferencesSchema.parse({ ...body, overdueAlerts: { ...body.overdueAlerts, time: "19:45" } }).overdueAlerts.time).toBe("19:45");
    expect(notificationPreferencesSchema.safeParse({ ...body, overdueAlerts: { ...body.overdueAlerts, time: "19:50" } }).success).toBe(false);
  });
});

describe("push snooze option (NOTIFICATION-011)", () => {
  it("defaults to 1 hour for stored preferences and older clients, and accepts the three options only", () => {
    const stored = { ...DEFAULT_NOTIFICATION_PREFERENCES, pushSnooze: undefined } as unknown as NotificationPreferences;
    expect(withPreferenceDefaults(stored).pushSnooze).toBe("1H");
    const body = { ...DEFAULT_NOTIFICATION_PREFERENCES } as Record<string, unknown>;
    delete body.pushSnooze;
    expect(notificationPreferencesSchema.parse(body).pushSnooze).toBe("1H");
    expect(notificationPreferencesSchema.parse({ ...body, pushSnooze: "TOMORROW" }).pushSnooze).toBe("TOMORROW");
    expect(notificationPreferencesSchema.safeParse({ ...body, pushSnooze: "NEVER" }).success).toBe(false);
  });
});
