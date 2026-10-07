/** FOOD-006: the weekly planner on the seed catalog and the family profile. */

import { describe, expect, it } from "vitest";
import { checkWeek, emptyWeek, parseSlotId, plan, seededRandom, slotIdOf, weekStartOf, type DishResponse, type PlannedMeal } from "../src/meals/index.js";
import { catalogDishResponses, dishNamed, familyProfile } from "./mocks/meals.js";

const DISHES = catalogDishResponses();
const PROFILE = familyProfile();
const WEEK = "2026-10-12";

function toMeals(result: ReturnType<typeof plan>, dishes: readonly DishResponse[] = DISHES): PlannedMeal[] {
  const byId = new Map(dishes.map((dish) => [dish.dishId, dish]));
  return emptyWeek(WEEK).map((meal) => {
    const slot = result.slots.find((candidate) => candidate.slotId === meal.slotId);
    return { ...meal, dish: slot?.dishId ? (byId.get(slot.dishId) ?? null) : null };
  });
}

describe("weeks", () => {
  it("finds the week start for Monday and Sunday weeks", () => {
    expect(weekStartOf("2026-10-14", "MONDAY")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-12", "MONDAY")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18", "MONDAY")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-14", "SUNDAY")).toBe("2026-10-11");
    expect(weekStartOf("2026-10-11", "SUNDAY")).toBe("2026-10-11");
  });

  it("lists 14 meals and parses slot IDs", () => {
    const week = emptyWeek(WEEK);
    expect(week).toHaveLength(14);
    expect(week[0]).toMatchObject({ slotId: "2026-10-12#LUNCH", weekday: "MON", slot: "LUNCH", dish: null });
    expect(week[13]).toMatchObject({ slotId: "2026-10-18#DINNER", weekday: "SUN" });
    expect(parseSlotId(slotIdOf("2026-10-12", "DINNER"))).toEqual({ date: "2026-10-12", slot: "DINNER" });
    expect(parseSlotId("2026-10-12#BREAKFAST")).toBeUndefined();
  });

  it("has a deterministic random source", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seededRandom(43)()).not.toBe(seededRandom(42)());
  });
});

describe("plan", () => {
  it("plans a complete week without hard violations for many seeds", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, seed });
      expect(result.complete, `seed ${seed}`).toBe(true);
      expect(result.slots.every((slot) => slot.dishId !== null)).toBe(true);
      const hard = checkWeek(toMeals(result), PROFILE).filter((violation) => violation.severity === "HARD");
      expect(hard, `seed ${seed}`).toEqual([]);
    }
  });

  it("is reproducible with the same seed and varies with another", () => {
    const first = plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, seed: 7 });
    expect(plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, seed: 7 })).toEqual(first);
    const others = [8, 9, 10].map((seed) => plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, seed }).slots.map((slot) => slot.dishId).join());
    expect(others.some((other) => other !== first.slots.map((slot) => slot.dishId).join())).toBe(true);
  });

  it("keeps fixed meals and plans around them", () => {
    const lasagne = dishNamed(DISHES, "Lasagne");
    const fixed = new Map<string, DishResponse | null>([
      ["2026-10-14#DINNER", lasagne],
      ["2026-10-15#LUNCH", null],
    ]);
    const result = plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, fixed, seed: 3 });
    expect(result.slots.find((slot) => slot.slotId === "2026-10-14#DINNER")?.dishId).toBe(lasagne.dishId);
    expect(result.slots.find((slot) => slot.slotId === "2026-10-15#LUNCH")).toEqual({ slotId: "2026-10-15#LUNCH", dishId: null });
    const meals = toMeals(result);
    expect(meals.filter((meal) => meal.dish?.proteinSources.includes("MINCE"))).toHaveLength(1);
  });

  it("leaves meals empty with a reason when nothing fits, never breaking a hard rule", () => {
    const fewDishes = ["Lasagne", "Burger", "Hot Dogs"].map((name) => dishNamed(DISHES, name));
    const result = plan({ weekStart: WEEK, dishes: fewDishes, profile: PROFILE, seed: 1 });
    expect(result.complete).toBe(false);
    const monLunch = result.slots.find((slot) => slot.slotId === "2026-10-12#LUNCH");
    expect(monLunch).toEqual({ slotId: "2026-10-12#LUNCH", dishId: null, emptyReason: "Kein Gericht passt (meist: mittags leicht)." });
    expect(checkWeek(toMeals(result, fewDishes), PROFILE).filter((violation) => violation.severity === "HARD")).toEqual([]);
    expect(plan({ weekStart: WEEK, dishes: [], profile: PROFILE, seed: 1 }).slots[0]).toMatchObject({ emptyReason: "Noch keine Gerichte angelegt." });
  });

  it("avoids last week's dishes when it can", () => {
    const lastWeek = plan({ weekStart: "2026-10-05", dishes: DISHES, profile: PROFILE, seed: 11 });
    const recent = new Set(lastWeek.slots.flatMap((slot) => (slot.dishId ? [slot.dishId] : [])));
    const result = plan({ weekStart: WEEK, dishes: DISHES, profile: PROFILE, seed: 12, context: { recentDishIds: recent } });
    const repeats = result.slots.filter((slot) => slot.dishId && recent.has(slot.dishId)).length;
    expect(repeats).toBeLessThanOrEqual(4);
  });

  it("plans 100 dishes within a second", () => {
    const many = [...DISHES, ...DISHES.map((dish) => ({ ...dish, dishId: `${dish.dishId}-b`, name: `${dish.name} B`, group: dish.group ? `${dish.group} B` : `${dish.name} B` }))].slice(0, 100);
    const started = performance.now();
    plan({ weekStart: WEEK, dishes: many, profile: PROFILE, seed: 5 });
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
