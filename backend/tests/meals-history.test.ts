/** FOOD-023: meal history, status and feedback, and how the planner uses them. */

import { describe, expect, it } from "vitest";
import {
  createMealServices,
  DEFAULT_HOUSEHOLD_FOOD_RULES,
  dishHistory,
  effectiveStatus,
  foodProfileSchema,
  historyContext,
  plan,
  score,
  weekViolations,
  type MealRecord,
  type PlannedMeal,
} from "../src/meals/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { catalogDishResponses, familyProfile } from "./mocks/meals.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-14T08:00:00Z");
const record = (date: string, dishId: string, status: MealRecord["status"] = "COOKED", feedback?: MealRecord["feedback"]): MealRecord => ({
  slotId: `${date}#DINNER`,
  date,
  dishId,
  status,
  ...(feedback ? { feedback } : {}),
});

describe("history helpers", () => {
  it("counts a planned meal as cooked after two days", () => {
    expect(effectiveStatus({ date: "2026-10-12", status: "PLANNED" }, "2026-10-14")).toBe("COOKED");
    expect(effectiveStatus({ date: "2026-10-13", status: "PLANNED" }, "2026-10-14")).toBe("PLANNED");
    expect(effectiveStatus({ date: "2026-10-01", status: "SKIPPED" }, "2026-10-14")).toBe("SKIPPED");
  });

  it("collects the last eaten date before the week and the latest feedback per dish", () => {
    const context = historyContext(
      [
        record("2026-10-05", "a", "COOKED", "DOWN"),
        record("2026-10-09", "a", "COOKED", "UP"),
        record("2026-10-10", "b", "SKIPPED"),
        record("2026-10-11", "c", "OTHER"),
        record("2026-10-11", "d", "PLANNED"),
        record("2026-10-13", "e", "COOKED", "DOWN"),
      ],
      "2026-10-12",
    );
    expect([...context.lastEaten]).toEqual([
      ["a", "2026-10-09"],
      ["d", "2026-10-11"],
    ]);
    expect([...context.likedDishIds]).toEqual(["a"]);
    expect([...context.dislikedDishIds]).toEqual(["e"]);
  });

  it("summarises dishes: last eaten up to today, times in 90 days, feedback", () => {
    expect(
      dishHistory([record("2026-06-01", "a"), record("2026-10-01", "a", "COOKED", "UP"), record("2026-10-12", "a", "PLANNED"), record("2026-10-20", "a", "PLANNED"), record("2026-10-05", "b", "SKIPPED")], "2026-10-14"),
    ).toEqual([
      { dishId: "a", lastEaten: "2026-10-12", timesLast90Days: 2, feedback: "UP" },
      { dishId: "b", lastEaten: null, timesLast90Days: 0, feedback: null },
    ]);
  });
});

describe("planner weighting", () => {
  const DISHES = catalogDishResponses();
  const PROFILE = familyProfile();
  const dish = DISHES.find((candidate) => candidate.slots.includes("DINNER") && candidate.lightness === "FILLING") ?? DISHES[0];
  const meal = (date: string): PlannedMeal => ({ slotId: `${date}#DINNER`, date, weekday: "MON", slot: "DINNER", dish: dish ?? null });

  it("penalises dishes eaten within 7 days, stronger within 3", () => {
    const id = dish?.dishId ?? "";
    const base = score([meal("2026-10-12")], PROFILE);
    const sixDays = score([meal("2026-10-12")], PROFILE, { lastEaten: new Map([[id, "2026-10-06"]]) });
    const twoDays = score([meal("2026-10-12")], PROFILE, { lastEaten: new Map([[id, "2026-10-10"]]) });
    const longAgo = score([meal("2026-10-12")], PROFILE, { lastEaten: new Map([[id, "2026-09-01"]]) });
    expect(sixDays).toBeLessThan(base);
    expect(twoDays).toBeLessThan(sixDays);
    expect(longAgo).toBe(base);
    expect(weekViolations([meal("2026-10-12")], PROFILE, { lastEaten: new Map([[id, "2026-10-10"]]) }).find((violation) => violation.rule === "R12")?.message).toMatch(/vor 2 Tagen schon\.$/);
  });

  it("prefers favorites and 👍, avoids 👎", () => {
    const id = dish?.dishId ?? "";
    const base = score([meal("2026-10-12")], PROFILE);
    expect(score([meal("2026-10-12")], PROFILE, { likedDishIds: new Set([id]) })).toBe(base + 1);
    expect(score([meal("2026-10-12")], PROFILE, { dislikedDishIds: new Set([id]) })).toBe(base - 3);
    expect(score([{ ...meal("2026-10-12"), dish: dish ? { ...dish, favorite: true } : null }], PROFILE)).toBe(base + (dish?.favorite ? 0 : 1));
  });

  it("plans liked dishes more often and recent ones less often (seeded)", () => {
    const ids = DISHES.map((candidate) => candidate.dishId);
    const liked = new Set(ids.slice(0, 10));
    const count = (result: ReturnType<typeof plan>, set: ReadonlySet<string>) => result.slots.filter((slot) => slot.dishId && set.has(slot.dishId)).length;
    let withLikes = 0;
    let withoutLikes = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      withLikes += count(plan({ weekStart: "2026-10-12", dishes: DISHES, profile: PROFILE, seed, context: { likedDishIds: liked } }), liked);
      withoutLikes += count(plan({ weekStart: "2026-10-12", dishes: DISHES, profile: PROFILE, seed }), liked);
    }
    expect(withLikes).toBeGreaterThanOrEqual(withoutLikes);
    const recent = new Map(ids.slice(10, 30).map((id) => [id, "2026-10-11"] as const));
    let repeats = 0;
    let baseline = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      repeats += count(plan({ weekStart: "2026-10-12", dishes: DISHES, profile: PROFILE, seed, context: { lastEaten: recent } }), new Set(recent.keys()));
      baseline += count(plan({ weekStart: "2026-10-12", dishes: DISHES, profile: PROFILE, seed }), new Set(recent.keys()));
    }
    expect(repeats).toBeLessThan(baseline);
  });
});

describe("meal status (service)", () => {
  function setup() {
    const meals = inMemoryMeals();
    let next = 0;
    const services = createMealServices({
      client: meals.sender,
      tableName: "tenner-meals",
      membersOf: async () => SEED_MEMBERS,
      settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn: "MONDAY" }),
      clock: () => NOW,
      ids: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
    });
    return { meals, services };
  }

  async function ready(services: ReturnType<typeof setup>["services"]) {
    await services.catalog.importCatalog(TEST_IDENTITY, false);
    await services.profiles.updateProfile(TEST_IDENTITY, validate(foodProfileSchema, { eaters: [{ eaterId: "a1", name: "Erwachsener 1", type: "ADULT" }], household: DEFAULT_HOUSEHOLD_FOOD_RULES }));
    return services.plans.getPlan("default", "current");
  }

  it("marks today's and past meals, stores feedback, and changes it", async () => {
    const { services, meals } = setup();
    const planned = await ready(services);
    const cooked = await services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-14#LUNCH", { status: "COOKED", feedback: "UP" });
    expect(cooked.slots.find((slot) => slot.slotId === "2026-10-14#LUNCH")).toMatchObject({ status: "COOKED", feedback: "UP" });
    const changed = await services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-14#LUNCH", { status: "COOKED", feedback: "DOWN" });
    expect(changed.slots.find((slot) => slot.slotId === "2026-10-14#LUNCH")?.feedback).toBe("DOWN");
    const skipped = await services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-12#DINNER", { status: "SKIPPED" });
    const monday = skipped.slots.find((slot) => slot.slotId === "2026-10-12#DINNER");
    expect(monday).toMatchObject({ status: "SKIPPED", dishId: planned.slots.find((slot) => slot.slotId === "2026-10-12#DINNER")?.dishId });
    expect(monday?.feedback).toBeUndefined();
    const stored = meals.items.get("default|PLAN#2026-10-12");
    expect(stored?.expiresAt).toBe(Date.parse("2027-11-16T00:00:00Z") / 1000);
    const history = await services.plans.dishHistory("default");
    const lunchDish = planned.slots.find((slot) => slot.slotId === "2026-10-14#LUNCH")?.dishId;
    expect(history.find((entry) => entry.dishId === lunchDish)).toMatchObject({ lastEaten: "2026-10-14", feedback: "DOWN" });
  });

  it("rejects future meals, feedback without cooking and unknown meals", async () => {
    const { services } = setup();
    await ready(services);
    await expect(services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { status: "COOKED" })).rejects.toMatchObject({ code: "MEAL_IN_FUTURE" });
    await expect(services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-14#LUNCH", { status: "SKIPPED", feedback: "UP" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-30#LUNCH", { status: "COOKED" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("uses the household's feedback when replanning", async () => {
    const { services } = setup();
    const planned = await ready(services);
    const lunch = planned.slots.find((slot) => slot.slotId === "2026-10-14#LUNCH");
    await services.plans.setMealStatus(TEST_IDENTITY, "current", "2026-10-14#LUNCH", { status: "COOKED", feedback: "DOWN" });
    const context = await services.plans.ruleContext("default", "2026-10-19");
    expect(context.dislikedDishIds?.has(lunch?.dishId ?? "")).toBe(true);
    expect(context.lastEaten?.get(lunch?.dishId ?? "")).toBe("2026-10-14");
  });
});
