/** ALEXA-007: Echo Show widget — LWA tokens, Data Store push, summary, debounce, day start, routing. */

import { describe, expect, it, vi } from "vitest";
import { DATASTORE_SCOPE, LWA_TOKEN_URL, LwaError, WidgetPushService, createDataStoreClient, createLwaTokenClient, mealDay, mealWidget, shoppingWidget, widgetSummary, type DataStoreClient, type DayMeal, type ShoppingListEntry } from "../src/alexa/index.js";
import { loadConfig } from "../src/config.js";
import type { DashboardResponse } from "../src/dto/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { createNotifierRuntime, handleNotifierEvent, mealsOn, shoppingListOf, type NotifierRuntime } from "../src/notifier.js";
import { NotFoundError } from "../src/exceptions/index.js";
import { memoryDeliveryLog } from "./mocks/delivery-log.js";
import { mockLogger, testConfig } from "./mocks/index.js";

const SECRET = "lwa-SECRET-marker";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("LWA token client", () => {
  it("requests client-credential tokens per scope and caches them until shortly before expiry", async () => {
    let now = 0;
    const fetchMock = vi.fn(async () => json(200, { access_token: "tok", expires_in: 3600 }));
    const client = createLwaTokenClient({ credentials: async () => ({ clientId: "id", clientSecret: SECRET }), fetch: fetchMock as unknown as typeof fetch, now: () => now });
    expect(await client.token(DATASTORE_SCOPE)).toBe("tok");
    expect(await client.token(DATASTORE_SCOPE)).toBe("tok");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(LWA_TOKEN_URL);
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ grant_type: "client_credentials", client_id: "id", client_secret: SECRET, scope: "alexa::datastore" });
    now = 3_600_000 - 59_000;
    await client.token(DATASTORE_SCOPE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails without leaking the secret", async () => {
    const failing = createLwaTokenClient({ credentials: async () => ({ clientId: "id", clientSecret: SECRET }), fetch: (async () => json(401, { error: "invalid_client" })) as unknown as typeof fetch });
    const error = await failing.token("s").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LwaError);
    expect(String(error)).not.toContain(SECRET);
    await expect(createLwaTokenClient({ credentials: async () => ({ clientId: "i", clientSecret: "s" }), fetch: (async () => Promise.reject(new Error("net"))) as unknown as typeof fetch }).token("s")).rejects.toThrow("LWA token request failed.");
    await expect(createLwaTokenClient({ credentials: async () => ({ clientId: "i", clientSecret: "s" }), fetch: (async () => json(200, {})) as unknown as typeof fetch }).token("s")).rejects.toThrow(LwaError);
  });
});

describe("Data Store client", () => {
  it("puts the widget object for one user", async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    expect(await createDataStoreClient("https://api.eu.amazonalexa.com", fetchMock as unknown as typeof fetch).putObjects("tok", "amzn1.ask.account.X", [{ key: "status", content: { dueToday: 3 } }])).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.eu.amazonalexa.com/v1/datastore/commands");
    expect(init.headers).toMatchObject({ authorization: "Bearer tok" });
    expect(JSON.parse(String(init.body))).toEqual({ commands: [{ type: "PUT_OBJECT", namespace: "tenner", key: "status", content: { dueToday: 3 } }], target: { type: "USER", id: "amzn1.ask.account.X" } });
  });

  it("puts several widget objects in one request (FOOD-018)", async () => {
    const fetchMock = vi.fn(async () => json(200, {}));
    await createDataStoreClient("https://x", fetchMock as unknown as typeof fetch).putObjects("tok", "u", [
      { key: "status", content: { dueToday: 3 } },
      { key: "meals", content: { lunch: "Onigiri" } },
    ]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(String(init.body)) as { commands: unknown[] }).commands).toEqual([
      { type: "PUT_OBJECT", namespace: "tenner", key: "status", content: { dueToday: 3 } },
      { type: "PUT_OBJECT", namespace: "tenner", key: "meals", content: { lunch: "Onigiri" } },
    ]);
  });

  it("reports gone users and other failures", async () => {
    const client = (response: () => Promise<Response>) => createDataStoreClient("https://x", response as unknown as typeof fetch);
    expect(await client(async () => json(404, {})).putObjects("t", "u", [])).toEqual({ ok: false, status: 404, userGone: true });
    expect(await client(async () => json(500, {})).putObjects("t", "u", [])).toEqual({ ok: false, status: 500, userGone: false });
    expect(await client(async () => Promise.reject(new Error("x"))).putObjects("t", "u", [])).toEqual({ ok: false, status: undefined, userGone: false });
  });
});

const DASHBOARD = {
  referenceDate: "2026-10-06",
  timezone: "Europe/Berlin",
  summary: { dueTodayCount: 3, overdueCount: 1, upcomingCount: 0, dueTodayMinutes: 15, overdueMinutes: 10, upcomingMinutes: 0, totalActionableCount: 4, totalActionableMinutes: 25 },
  dueToday: [
    { tennerId: "a", title: "Altglas", category: "HOUSEHOLD", assignedTo: "STEFAN", originalAssignee: null, estimatedMinutes: 5, nextDue: "2026-10-06", snoozedUntil: null },
    { tennerId: "b", title: "Spülmaschine", category: "HOUSEHOLD", assignedTo: "HOUSEHOLD", originalAssignee: null, estimatedMinutes: 10, nextDue: "2026-10-06", snoozedUntil: null },
  ],
  overdue: [{ tennerId: "c", title: "Haustür", category: "HOME", assignedTo: "JULIA", originalAssignee: null, estimatedMinutes: 10, nextDue: "2026-10-02", snoozedUntil: null, overdueDays: 4 }],
  upcoming: [],
  paused: [],
  byUser: { STEFAN: { count: 2, estimatedMinutes: 10 }, JULIA: { count: 2, estimatedMinutes: 15 } },
  byCategory: {},
} as DashboardResponse;

describe("widgetSummary (Summary Payload Mapping)", () => {
  it("maps counts, the next two Tenners (overdue first) and member counts without IDs", () => {
    expect(widgetSummary(DASHBOARD, SEED_MEMBERS, new Date("2026-10-06T07:00:00Z"))).toEqual({
      date: "2026-10-06",
      dueToday: 3,
      openMinutes: 25,
      overdue: 1,
      next: [
        { title: "Haustür", minutes: 10, member: "Julia" },
        { title: "Altglas", minutes: 5, member: "Stefan" },
      ],
      members: [
        { name: "Stefan", count: 2 },
        { name: "Julia", count: 2 },
      ],
      updatedAt: "2026-10-06T07:00:00.000Z",
    });
  });
});

function pushSetup(options: { users?: string[]; dataStore?: DataStoreClient; mealsOn?: (tenantId: string, date: string) => Promise<readonly DayMeal[]>; shoppingList?: (tenantId: string) => Promise<readonly ShoppingListEntry[]> } = {}) {
  const clock = { now: new Date("2026-10-06T07:00:00Z") };
  const { log, records } = memoryDeliveryLog();
  const dataStore = options.dataStore ?? { putObjects: vi.fn(async () => ({ ok: true as const })) };
  const removeAlexaUser = vi.fn(async () => undefined);
  const lwa = { token: vi.fn(async () => "tok") };
  const logger = mockLogger();
  const service = new WidgetPushService({
    alexaUsers: async () => options.users ?? ["amzn1.ask.account.A"],
    removeAlexaUser,
    dashboard: async () => DASHBOARD,
    members: async () => SEED_MEMBERS,
    timezoneOf: async () => "Europe/Berlin",
    ...(options.mealsOn ? { mealsOn: options.mealsOn } : {}),
    ...(options.shoppingList ? { shoppingList: options.shoppingList } : {}),
    lwa,
    dataStore,
    log,
    logger,
    now: () => clock.now,
  });
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return { service, dataStore, removeAlexaUser, lwa, records, advance, logger };
}

describe("WidgetPushService", () => {
  it("pushes on a change and debounces further changes within a minute (Debounce)", async () => {
    const w = pushSetup();
    await w.service.onChange("default");
    w.advance(20_000);
    await w.service.onChange("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledOnce();
    expect(w.lwa.token).toHaveBeenCalledWith("alexa::datastore");
    expect(w.records.has("default#WIDGET#DIRTY")).toBe(true);
    // The pending change is pushed by the next scheduled run.
    w.advance(15 * 60_000);
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(2);
    w.advance(15 * 60_000);
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(2);
    w.advance(61_000);
    await w.service.onChange("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(3);
  });

  it("pushes once at the start of a new household day (Day Start Push In Household Timezone)", async () => {
    const w = pushSetup();
    await w.service.onSchedule("default"); // nothing pushed yet → day start
    expect(w.dataStore.putObjects).toHaveBeenCalledOnce();
    w.advance(60 * 60_000);
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledOnce();
    w.advance(16 * 60 * 60_000); // 2026-10-06T23:00Z = 01:00 on 7 October in Berlin
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(2);
  });

  it("retries a failed push once and logs (Push Failure Logged And Retried Once)", async () => {
    const putObjects = vi.fn(async () => ({ ok: false as const, status: 500, userGone: false }));
    const w = pushSetup({ dataStore: { putObjects } });
    await w.service.onChange("default");
    expect(putObjects).toHaveBeenCalledTimes(2);
    expect(w.logger.warn).toHaveBeenCalledWith("Widget push failed", { event: "WidgetPushFailed", status: 500 });
    expect(JSON.stringify(w.logger.info.mock.calls)).not.toContain("amzn1.ask.account");
  });

  it("removes users Amazon no longer accepts (Unlinked User Removed From Push Targets)", async () => {
    const putObjects = vi.fn(async () => ({ ok: false as const, status: 404, userGone: true }));
    const w = pushSetup({ dataStore: { putObjects } });
    await w.service.onChange("default");
    expect(putObjects).toHaveBeenCalledOnce();
    expect(w.removeAlexaUser).toHaveBeenCalledWith("default", "amzn1.ask.account.A");
  });

  it("does nothing without Alexa users", async () => {
    const w = pushSetup({ users: [] });
    await w.service.onChange("default");
    expect(w.lwa.token).not.toHaveBeenCalled();
  });
});

describe("meal widget (FOOD-018)", () => {
  const MEALS: DayMeal[] = [
    { slot: "LUNCH", dish: { name: "Onigiri" } },
    { slot: "DINNER", dish: { name: "Lasagne" } },
  ];

  it("shows today until 20:00 household time, then tomorrow (also across a month end)", () => {
    expect(mealDay(new Date("2026-10-06T17:59:00Z"), "Europe/Berlin")).toEqual({ date: "2026-10-06", title: "Heute" });
    expect(mealDay(new Date("2026-10-06T18:00:00Z"), "Europe/Berlin")).toEqual({ date: "2026-10-07", title: "Morgen" });
    expect(mealDay(new Date("2026-10-31T19:30:00Z"), "Europe/Berlin")).toEqual({ date: "2026-11-01", title: "Morgen" });
    expect(mealDay(new Date("2026-10-06T22:30:00Z"), "Europe/Berlin")).toEqual({ date: "2026-10-07", title: "Heute" });
  });

  it("maps full, partial and empty days to dish names", () => {
    const now = new Date("2026-10-06T07:00:00Z");
    const day = { date: "2026-10-06", title: "Heute" };
    expect(mealWidget(day, MEALS, now)).toEqual({ title: "Heute", date: "2026-10-06", lunch: "Onigiri", dinner: "Lasagne", updatedAt: "2026-10-06T07:00:00.000Z" });
    expect(mealWidget(day, [{ slot: "LUNCH", dish: null }, { slot: "DINNER", dish: { name: "Lasagne" } }], now)).toMatchObject({ lunch: "–", dinner: "Lasagne" });
    expect(mealWidget(day, [], now)).toMatchObject({ lunch: "–", dinner: "–" });
  });

  it("pushes the meals with the status in one request", async () => {
    const mealsOnMock = vi.fn(async () => MEALS);
    const w = pushSetup({ mealsOn: mealsOnMock });
    await w.service.onChange("default");
    expect(mealsOnMock).toHaveBeenCalledWith("default", "2026-10-06");
    const objects = (w.dataStore.putObjects as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as { key: string; content: unknown }[];
    expect(objects.map((object) => object.key)).toEqual(["status", "meals"]);
    expect(objects[1]?.content).toMatchObject({ title: "Heute", lunch: "Onigiri", dinner: "Lasagne" });
  });

  it("still pushes the status when the meal plan fails", async () => {
    const w = pushSetup({ mealsOn: async () => Promise.reject(new TypeError("boom")) });
    await w.service.onChange("default");
    const objects = (w.dataStore.putObjects as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as { key: string }[];
    expect(objects.map((object) => object.key)).toEqual(["status"]);
    expect(w.logger.warn).toHaveBeenCalledWith("Meal widget data unavailable", { event: "MealWidgetFailed", error: "TypeError" });
  });

  it("pushes once more at 20:00 so the widget shows tomorrow", async () => {
    const w = pushSetup({ mealsOn: async () => MEALS });
    await w.service.onSchedule("default"); // 09:00 Berlin: day start
    w.advance(10 * 60 * 60_000 + 50 * 60_000); // 19:50
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledOnce();
    w.advance(15 * 60_000); // 20:05
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(2);
    expect(w.logger.info).toHaveBeenLastCalledWith("Widget pushed", { event: "WidgetPushed", reason: "EVENING", targets: 1, pushed: 1 });
    w.advance(15 * 60_000);
    await w.service.onSchedule("default");
    expect(w.dataStore.putObjects).toHaveBeenCalledTimes(2);
  });

  it("reads the date from the current week, else from the next week", async () => {
    const plan = (slots: { date: string; slot: string; dish: { name: string } | null }[]) => ({ slots });
    const getPlan = vi.fn(async (_tenantId: string, week: string) =>
      week === "current" ? plan([{ date: "2026-10-11", slot: "DINNER", dish: { name: "Suppe" } }]) : plan([{ date: "2026-10-12", slot: "LUNCH", dish: null }]),
    );
    const plans = { getPlan } as unknown as Parameters<typeof mealsOn>[0];
    expect(await mealsOn(plans, "default", "2026-10-11")).toEqual([{ date: "2026-10-11", slot: "DINNER", dish: { name: "Suppe" } }]);
    expect(getPlan).toHaveBeenCalledTimes(1);
    expect(await mealsOn(plans, "default", "2026-10-12")).toEqual([{ date: "2026-10-12", slot: "LUNCH", dish: null }]);
    expect(await mealsOn(plans, "default", "2026-10-30")).toEqual([]);
  });
});

describe("shopping list widget (FOOD-026)", () => {
  const entry = (name: string, extra: Partial<ShoppingListEntry> = {}): ShoppingListEntry => ({ name, quantity: 1, unit: "Stück", checked: false, pantry: false, ...extra });

  it("shows open items in order with counts, without pantry and ticked items", () => {
    const now = new Date("2026-10-06T07:00:00Z");
    expect(shoppingWidget([entry("Nudeln", { quantity: 2 }), entry("Salz", { pantry: true }), entry("Eier", { checked: true }), entry("Klopapier", { quantity: null, unit: null })], now)).toEqual({
      open: 2,
      items: ["2× Nudeln", "Klopapier"],
      more: 0,
      updatedAt: "2026-10-06T07:00:00.000Z",
    });
    const many = shoppingWidget(Array.from({ length: 9 }, (_, index) => entry(`Ding ${index}`)), now);
    expect(many).toMatchObject({ open: 9, more: 3 });
    expect(many.items).toHaveLength(6);
  });

  it("pushes the list with the other widgets and isolates failures", async () => {
    const w = pushSetup({ shoppingList: async () => [entry("Milch")] });
    await w.service.onChange("default");
    const objects = (w.dataStore.putObjects as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as { key: string; content: unknown }[];
    expect(objects.map((object) => object.key)).toEqual(["status", "shopping"]);
    expect(objects[1]?.content).toMatchObject({ open: 1, items: ["Milch"] });
    const broken = pushSetup({ shoppingList: async () => Promise.reject(new TypeError("boom")) });
    await broken.service.onChange("default");
    expect((broken.dataStore.putObjects as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toHaveLength(1);
    expect(broken.logger.warn).toHaveBeenCalledWith("Shopping widget data unavailable", { event: "ShoppingWidgetFailed", error: "TypeError" });
  });

  it("reads this week's list and shows a week without a plan as empty", async () => {
    const getList = vi.fn(async () => ({ items: [entry("Milch")] }));
    expect(await shoppingListOf({ getList } as unknown as Parameters<typeof shoppingListOf>[0], "default")).toEqual([entry("Milch")]);
    expect(getList).toHaveBeenCalledWith("default", "current");
    getList.mockRejectedValueOnce(new NotFoundError("No meal plan."));
    expect(await shoppingListOf({ getList } as unknown as Parameters<typeof shoppingListOf>[0], "default")).toEqual([]);
    getList.mockRejectedValueOnce(new TypeError("boom"));
    await expect(shoppingListOf({ getList } as unknown as Parameters<typeof shoppingListOf>[0], "default")).rejects.toThrow("boom");
  });
});

describe("notifier event routing", () => {
  function runtime(widget?: Partial<WidgetPushService>): NotifierRuntime {
    const logger = mockLogger();
    const { log } = memoryDeliveryLog();
    return {
      notifier: { tenantId: "default", members: async () => [], timezoneOf: async () => "UTC", jobs: [], channels: [], log, logger, now: () => new Date() },
      widget: widget as WidgetPushService | undefined,
    };
  }

  it("refreshes the widget on HouseholdChanged and runs jobs plus the day-start check on schedule", async () => {
    const widget = { onChange: vi.fn(async () => undefined), onSchedule: vi.fn(async () => undefined) };
    expect(await handleNotifierEvent(runtime(widget), { "detail-type": "HouseholdChanged", detail: { tenantId: "default" } })).toEqual({ widget: "PUSHED_OR_SKIPPED" });
    expect(widget.onChange).toHaveBeenCalledWith("default");
    const scheduled = await handleNotifierEvent(runtime(widget), { "detail-type": "Scheduled Event" });
    expect(scheduled.run?.recipients).toBe(0);
    expect(widget.onSchedule).toHaveBeenCalledWith("default");
  });

  it("never fails the run because of the widget and reports a disabled widget", async () => {
    const broken = { onChange: vi.fn(async () => Promise.reject(new TypeError("x"))), onSchedule: vi.fn(async () => Promise.reject(new TypeError("x"))) };
    const r = runtime(broken);
    expect((await handleNotifierEvent(r, {})).widget).toBe("FAILED");
    expect(r.notifier.logger.error).toHaveBeenCalledWith("Widget update failed", { event: "WidgetUpdateFailed", error: "TypeError" });
    expect((await handleNotifierEvent(runtime(), { "detail-type": "HouseholdChanged", detail: {} })).widget).toBe("DISABLED");
  });

  it("prepares meal plans on schedule and never fails the run because of them (FOOD-006)", async () => {
    const r = runtime();
    const ensurePlans = vi.fn(async () => 2);
    const withPlans = { ...r, mealPlans: { ensurePlans } as unknown as NonNullable<NotifierRuntime["mealPlans"]> };
    expect((await handleNotifierEvent(withPlans, {})).mealPlans).toBe(2);
    expect(ensurePlans).toHaveBeenCalledWith("default");
    expect(r.notifier.logger.info).toHaveBeenCalledWith("Meal plans prepared", { event: "MealPlansPrepared", created: 2 });
    ensurePlans.mockRejectedValueOnce(new TypeError("boom"));
    const failed = await handleNotifierEvent(withPlans, {});
    expect(failed.mealPlans).toBe("FAILED");
    expect(failed.run?.recipients).toBe(0);
    expect(r.notifier.logger.error).toHaveBeenCalledWith("Meal plan preparation failed", { event: "MealPlansFailed", error: "TypeError" });
    expect((await handleNotifierEvent(runtime(), {})).mealPlans).toBe("DISABLED");
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n" })).mealPlans).toBeDefined();
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n", mealsTable: undefined })).mealPlans).toBeUndefined();
  });

  it("moves missed Tenners before the jobs and never fails the run because of them (REC-001)", async () => {
    const r = runtime();
    const order: string[] = [];
    const moveMissed = vi.fn(async () => {
      order.push("missed");
      return 2;
    });
    const ensurePlans = vi.fn(async () => {
      order.push("plans");
      return 0;
    });
    const withMissed = { ...r, missedTenners: { moveMissed }, mealPlans: { ensurePlans } as unknown as NonNullable<NotifierRuntime["mealPlans"]> };
    expect((await handleNotifierEvent(withMissed, {})).missedTenners).toBe(2);
    expect(order).toEqual(["missed", "plans"]);
    expect(r.notifier.logger.info).toHaveBeenCalledWith("Missed Tenners moved", { event: "MissedTennersMoved", moved: 2 });
    moveMissed.mockRejectedValueOnce(new TypeError("boom"));
    const failed = await handleNotifierEvent(withMissed, {});
    expect(failed.missedTenners).toBe("FAILED");
    expect(failed.run?.recipients).toBe(0);
    expect((await handleNotifierEvent(runtime(), {})).missedTenners).toBe("DISABLED");
    expect((await handleNotifierEvent(withMissed, { "detail-type": "HouseholdChanged", detail: {} })).missedTenners).toBeUndefined();
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n" })).missedTenners).toBeDefined();
  });

  it("creates the widget service only with Alexa API configuration", () => {
    const alexaApi = { endpoint: "https://api.eu.amazonalexa.com", clientIdParameter: "/tenner/prod/alexa/lwa-client-id", clientSecretParameter: "/tenner/prod/alexa/lwa-client-secret", skillStage: "development" as const };
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n", alexaApi })).widget).toBeInstanceOf(WidgetPushService);
    expect(loadConfig({ ALEXA_API_ENDPOINT: "https://api.eu.amazonalexa.com/", ALEXA_LWA_CLIENT_ID_PARAMETER: "/a", ALEXA_LWA_CLIENT_SECRET_PARAMETER: "/b" }).alexaApi).toEqual({
      endpoint: "https://api.eu.amazonalexa.com",
      clientIdParameter: "/a",
      clientSecretParameter: "/b",
      skillStage: "development",
    });
    expect(loadConfig({ ALEXA_API_ENDPOINT: "https://x" }).alexaApi).toBeUndefined();
  });
});
