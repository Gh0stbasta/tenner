/** FOOD-017: „Was gibt es heute?“ — answers, day and meal slots, briefing sentence, API errors. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBriefing, type BriefingDashboard } from "../src/briefing.js";
import { dayIndex, mealAnswer, mealSentence, spokenDish, type MealDay, type MealDays } from "../src/meals.js";
import { createSkill } from "../src/skill.js";
import { KITCHEN_DAY } from "./dashboardFixtures.js";
import { PERSON_ID, SKILL_ID, intentRequest } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const TODAY: MealDay = {
  date: "2026-10-05",
  meals: [
    { slot: "LUNCH", status: "PLANNED", dish: { name: "Onigiri", isVegetarian: true } },
    { slot: "DINNER", status: "PLANNED", dish: { name: "Burger", isVegetarian: false, vegetarianVariant: "mit Veggie-Patty" } },
  ],
};
const TOMORROW: MealDay = { date: "2026-10-06", meals: [{ slot: "LUNCH", status: "PLANNED", dish: null }, { slot: "DINNER", status: "PLANNED", dish: { name: "Linseneintopf", isVegetarian: true } }] };
const DAYS: MealDays = { today: "2026-10-05", days: [TODAY, TOMORROW] };
const MEALS = "GET /meals/today?days=2";

function setup(routes: Record<string, FakeRoute> = {}) {
  const api = fakeApi({ [MEALS]: { data: DAYS }, ...routes });
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), api };
}

const meal = (id: "LUNCH" | "DINNER", value: string) => ({ value, id });

describe("meal answers", () => {
  it("names both meals, one meal, the vegetarian variant and empty slots", () => {
    expect(mealAnswer(TODAY, "heute")).toBe("Heute gibt es mittags Onigiri und abends Burger, für Vegetarier mit Veggie-Patty.");
    expect(mealAnswer(TODAY, "heute", "LUNCH")).toBe("Heute Mittag gibt es Onigiri.");
    expect(mealAnswer(TOMORROW, "morgen")).toBe("Morgen gibt es abends Linseneintopf. Mittags ist nichts geplant.");
    expect(mealAnswer(TOMORROW, "morgen", "LUNCH")).toBe("Für morgen Mittag ist noch nichts geplant.");
    expect(mealAnswer(undefined, "heute")).toBe("Für heute ist noch nichts geplant.");
    expect(mealAnswer({ date: "x", meals: [{ slot: "DINNER", status: "SKIPPED", dish: { name: "X", isVegetarian: true } }] }, "heute", "DINNER")).toBe("Für heute Abend ist noch nichts geplant.");
    expect(spokenDish({ name: "Salat", isVegetarian: true, vegetarianVariant: "x" })).toBe("Salat");
  });

  it("knows today and tomorrow only", () => {
    expect(dayIndex(undefined, "2026-10-31")).toBe(0);
    expect(dayIndex("2026-10-31", "2026-10-31")).toBe(0);
    expect(dayIndex("2026-11-01", "2026-10-31")).toBe(1);
    expect(dayIndex("2026-11-02", "2026-10-31")).toBeUndefined();
  });

  it("builds the briefing sentence without the „nichts geplant“ part", () => {
    expect(mealSentence(DAYS)).toBe("Heute gibt es mittags Onigiri und abends Burger, für Vegetarier mit Veggie-Patty.");
    expect(mealSentence({ today: "2026-10-06", days: [TOMORROW] })).toBe("Heute gibt es abends Linseneintopf.");
    expect(mealSentence({ today: "2026-10-07", days: [] })).toBeUndefined();
    const briefing = buildBriefing({
      dashboard: KITCHEN_DAY as BriefingDashboard,
      members: CONTEXT.members,
      speaker: undefined,
      now: new Date("2026-10-05T05:30:00Z"),
      timeZone: "Europe/Berlin",
      meals: "Heute gibt es abends Linseneintopf.",
    });
    expect(briefing.text).toMatch(/^Guten Morgen\. Heute stehen .*\. Heute gibt es abends Linseneintopf\. /);
  });
});

describe("MealTodayIntent", () => {
  it("answers today's meals in one API call", async () => {
    const { skill, api } = setup();
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent")))).toBe("<speak>Heute gibt es mittags Onigiri und abends Burger, für Vegetarier mit Veggie-Patty.</speak>");
    expect(api.calls.filter(([url]) => url.includes("/meals/")).map(([url]) => url)).toEqual([`${API_BASE}/meals/today?days=2`]);
  });

  it("answers tomorrow, a single meal and refuses later days", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent", { day: { value: "2026-10-06" } })))).toBe("<speak>Morgen gibt es abends Linseneintopf. Mittags ist nichts geplant.</speak>");
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent", { day: { value: "2026-10-05" }, meal: meal("DINNER", "abend") })))).toBe(
      "<speak>Heute Abend gibt es Burger, für Vegetarier mit Veggie-Patty.</speak>",
    );
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent", { meal: meal("LUNCH", "mittag") })))).toBe("<speak>Heute Mittag gibt es Onigiri.</speak>");
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent", { day: { value: "2026-10-09" } })))).toContain("nur das Essen für heute und morgen");
  });

  it("falls back to friendly speech when the API fails", async () => {
    const { skill } = setup({ [MEALS]: { status: 503, error: { code: "SERVICE_UNAVAILABLE" } } });
    expect(ssml(await skill.invoke(intentRequest("MealTodayIntent")))).toContain("Die Zentrale ist gerade nicht erreichbar");
  });
});

describe("briefing with meals", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T05:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("adds today's meals and still works when the meals fail", async () => {
    const routes = { "GET /household/alexa": { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "STEFAN" }] } }, "GET /dashboard": { data: KITCHEN_DAY } };
    const withMeals = setup(routes);
    expect(ssml(await withMeals.skill.invoke(intentRequest("BriefingIntent", {}, { person: { personId: PERSON_ID } })))).toContain("Heute gibt es mittags Onigiri und abends Burger");
    const failing = setup({ ...routes, [MEALS]: { status: 500, error: { code: "INTERNAL_ERROR" } } });
    const speech = ssml(await failing.skill.invoke(intentRequest("BriefingIntent", {}, { person: { personId: PERSON_ID } })));
    expect(speech).toMatch(/^<speak>Guten Morgen, Stefan\./);
    expect(speech).not.toContain("gibt es");
  });
});

describe("interaction model", () => {
  it("declares MealTodayIntent with day and meal slots", async () => {
    const { readFileSync } = await import("node:fs");
    const model = JSON.parse(readFileSync(new URL("../skill-package/interactionModels/custom/de-DE.json", import.meta.url), "utf8")).interactionModel.languageModel;
    const intent = model.intents.find((entry: { name: string }) => entry.name === "MealTodayIntent");
    expect(intent.slots).toEqual([{ name: "day", type: "AMAZON.DATE" }, { name: "meal", type: "MealSlot" }]);
    expect(intent.samples).toEqual(expect.arrayContaining(["was gibt es heute", "was es heute gibt", "was essen wir {day} {meal}", "was gibt es {day} {meal}", "was kochen wir {day}"]));
    expect(model.types.find((type: { name: string }) => type.name === "MealSlot").values.map((value: { id: string }) => value.id)).toEqual(["LUNCH", "DINNER"]);
  });
});
