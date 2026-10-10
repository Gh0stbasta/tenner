/** FOOD-016: „Essensplan am Morgen“ — timing, deduplication, content and Alexa wording. */

import { describe, expect, it, vi } from "vitest";
import { mealReminderText } from "../src/alexa/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "../src/models/index.js";
import { LogChannel, mealTodayJob, renderMealToday, runNotifier, type DeliveryLog, type Recipient, type TodayMeal } from "../src/notifications/index.js";
import { notificationPreferencesSchema, validate } from "../src/validators/index.js";
import { mockLogger } from "./mocks/index.js";

const RECIPIENT: Recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
/** 07:30 in Berlin (summer time). */
const AT_0730 = new Date("2026-10-06T05:30:00Z");
const MEALS: TodayMeal[] = [
  { slot: "DINNER", status: "PLANNED", dish: { name: "Burger", isVegetarian: false, vegetarianVariant: "mit Gemüse-Patty" } },
  { slot: "LUNCH", status: "PLANNED", dish: { name: "Onigiri", isVegetarian: true } },
];

function job(preferences: Partial<NotificationPreferences> = {}, meals: readonly TodayMeal[] = MEALS, vegetarian = false, open: number | undefined = 3) {
  const deps = {
    preferencesOf: vi.fn(async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences })),
    mealsOn: vi.fn(async () => meals),
    isVegetarian: vi.fn(async () => vegetarian),
    openShoppingItems: vi.fn(async () => open),
    appUrl: "https://app.test",
  };
  return { job: mealTodayJob(deps), deps };
}

describe("meal today job", () => {
  it("is due at the member's time in their timezone, not in quiet hours, only when enabled", async () => {
    expect(await job().job.channelsDue(RECIPIENT, AT_0730)).toEqual(["LOG"]);
    expect(await job({ mealToday: { enabled: true, time: "07:30", channels: ["WEB_PUSH", "ALEXA"] } }).job.channelsDue(RECIPIENT, AT_0730)).toEqual(["LOG", "WEB_PUSH", "ALEXA"]);
    expect(await job().job.channelsDue(RECIPIENT, new Date("2026-10-06T05:00:00Z"))).toEqual([]);
    expect(await job({ timezone: "Europe/London" }).job.channelsDue(RECIPIENT, new Date("2026-10-06T06:30:00Z"))).toEqual(["LOG"]);
    expect(await job({ mealToday: { enabled: false, time: "07:30", channels: [] } }).job.channelsDue(RECIPIENT, AT_0730)).toEqual([]);
    expect(await job({ quietHours: { start: "21:30", end: "08:00" } }).job.channelsDue(RECIPIENT, AT_0730)).toEqual([]);
  });

  it("names lunch and dinner, the shopping hint and links to the plan", async () => {
    const { job: meal, deps } = job();
    expect(await meal.render(RECIPIENT, AT_0730)).toEqual({
      type: "MEAL_TODAY",
      userId: "STEFAN",
      subject: "🍽️ Heute: Mittag Onigiri · Abend Burger",
      textBody: "Heute: Mittag Onigiri · Abend Burger\nEinkaufsliste: 3 Dinge offen",
      deepLink: "https://app.test/essen",
      facts: { lunch: "Onigiri", dinner: "Burger" },
    });
    expect(deps.mealsOn).toHaveBeenCalledWith("default", "2026-10-06");
  });

  it("names the vegetarian variant for a vegetarian member and leaves out an empty shopping hint", () => {
    expect(renderMealToday(MEALS, RECIPIENT, true, 0, undefined)).toMatchObject({
      subject: "🍽️ Heute: Mittag Onigiri · Abend Burger (für dich: mit Gemüse-Patty)",
      textBody: "Heute: Mittag Onigiri · Abend Burger (für dich: mit Gemüse-Patty)",
    });
    expect(renderMealToday(MEALS, RECIPIENT, false, 1, undefined)?.textBody).toBe("Heute: Mittag Onigiri · Abend Burger\nEinkaufsliste: 1 Ding offen");
    expect(renderMealToday(MEALS, RECIPIENT, false, 1, undefined)?.deepLink).toBeUndefined();
  });

  it("skips days without planned meals and skipped meals", async () => {
    expect(await job({}, []).job.render(RECIPIENT, AT_0730)).toBeUndefined();
    expect(await job({}, [{ slot: "LUNCH", dish: null }, { slot: "DINNER", status: "SKIPPED", dish: { name: "X", isVegetarian: true } }]).job.render(RECIPIENT, AT_0730)).toBeUndefined();
    expect(renderMealToday([{ slot: "DINNER", status: "COOKED", dish: { name: "Linseneintopf", isVegetarian: true } }], RECIPIENT, false, undefined, undefined)?.subject).toBe("🍽️ Heute: Abend Linseneintopf");
  });

  it("sends once per member and day", async () => {
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
      members: async () => [{ userId: "STEFAN", displayName: "Stefan", color: "BLUE" as const, active: true, canSignIn: true, createdAt: "t", updatedAt: "t" }],
      timezoneOf: async () => "Europe/Berlin",
      jobs: [job().job],
      channels: [new LogChannel(logger)],
      log,
      logger,
      now: () => AT_0730,
    };
    expect((await runNotifier(deps)).deliveries.SENT).toBe(1);
    expect((await runNotifier({ ...deps, now: () => new Date("2026-10-06T05:40:00Z") })).deliveries).toEqual({ SENT: 0, FAILED: 0, SKIPPED: 1 });
  });
});

describe("meal preferences and Alexa", () => {
  it("defaults to 07:30, accepts older clients and validates the time", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.mealToday).toEqual({ enabled: true, time: "07:30", channels: [] });
    const { mealToday: _omitted, ...older } = DEFAULT_NOTIFICATION_PREFERENCES;
    void _omitted;
    expect(validate(notificationPreferencesSchema, older).mealToday).toEqual({ enabled: true, time: "07:30", channels: [] });
    expect(() => validate(notificationPreferencesSchema, { ...DEFAULT_NOTIFICATION_PREFERENCES, mealToday: { enabled: true, time: "07:20", channels: [] } })).toThrow();
  });

  it("speaks today's meals", () => {
    const message = renderMealToday(MEALS, RECIPIENT, false, undefined, undefined);
    expect(message && mealReminderText(message)).toBe("Zentrale: Heute gibt es mittags Onigiri und abends Burger.");
  });
});
