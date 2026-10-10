/** FOOD-013: cost estimate per dish, per meal and per week. */

import { describe, expect, it } from "vitest";
import { createMealServices, DEFAULT_HOUSEHOLD_FOOD_RULES, estimateCost, foodProfileSchema, IngredientService, mealCost, PANTRY_FLAT_EUR } from "../src/meals/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-14T08:00:00Z");

function setup() {
  const meals = inMemoryMeals();
  let next = 0;
  return createMealServices({
    client: meals.sender,
    tableName: "tenner-meals",
    membersOf: async () => SEED_MEMBERS,
    settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn: "MONDAY" }),
    clock: () => NOW,
    ids: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  });
}

describe("estimateCost", () => {
  it("prices per 100 g and per piece, pantry flat, optional left out", async () => {
    const map = await new IngredientService(inMemoryMeals().store, () => NOW).ingredientsOf("default");
    const cost = estimateCost(
      {
        ingredients: [
          { ingredientId: "pasta", quantity: 125, unit: "g" }, // 0.20 €/100 g → 0.25
          { ingredientId: "egg", quantity: 2, unit: "Stück" }, // 0.30 €/piece → 0.60
          { ingredientId: "olive-oil", quantity: 1, unit: "EL" }, // pantry → flat
          { ingredientId: "passata", quantity: 150, unit: "g", optional: true },
        ],
      },
      map,
    );
    expect(cost).toEqual({ perAdultPortion: 0.85, pantry: PANTRY_FLAT_EUR, familyOverride: null, source: "INGREDIENTS", estimated: true, complete: true, missingIngredients: [] });
    expect(mealCost(cost, 3, 3)).toBe(2.65);
    expect(mealCost(cost, 2, 3)).toBe(1.8);
  });

  it("lets the family override win and scales it to the eaters present", async () => {
    const map = await new IngredientService(inMemoryMeals().store, () => NOW).ingredientsOf("default");
    const cost = estimateCost({ ingredients: [{ ingredientId: "pasta", quantity: 125, unit: "g" }], costOverride: 12 }, map);
    expect(cost).toMatchObject({ source: "OVERRIDE", familyOverride: 12, perAdultPortion: null });
    expect(mealCost(cost, 2.5, 2.5)).toBe(12);
    expect(mealCost(cost, 2, 2.5)).toBe(9.6);
    expect(mealCost(cost, 1, 0)).toBe(12);
  });

  it("flags unknown ingredients", async () => {
    const map = await new IngredientService(inMemoryMeals().store, () => NOW).ingredientsOf("default");
    expect(estimateCost({ ingredients: [{ ingredientId: "gone", quantity: 1, unit: "g" }] }, map)).toMatchObject({ complete: false, missingIngredients: ["gone"], perAdultPortion: 0 });
  });

  it("follows price changes of the household", async () => {
    const services = setup();
    const before = estimateCost({ ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }] }, await services.ingredients.ingredientsOf("default"));
    await services.ingredients.updateIngredient(TEST_IDENTITY, "pasta", { pricePerUnit: 0.5 });
    const after = estimateCost({ ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }] }, await services.ingredients.ingredientsOf("default"));
    expect([before.perAdultPortion, after.perAdultPortion]).toEqual([0.2, 0.5]);
  });
});

describe("plan costs", () => {
  it("prices each meal for its eaters and sums the week", async () => {
    const services = setup();
    await services.catalog.importCatalog(TEST_IDENTITY, false);
    await services.profiles.updateProfile(
      TEST_IDENTITY,
      validate(foodProfileSchema, {
        eaters: [
          { eaterId: "a1", name: "Erwachsener 1", type: "ADULT" },
          { eaterId: "a2", name: "Erwachsener 2", type: "ADULT" },
          { eaterId: "k1", name: "Kind 1", type: "CHILD" },
        ],
        household: DEFAULT_HOUSEHOLD_FOOD_RULES,
      }),
    );
    const plan = await services.plans.getPlan("default", "current");
    const weekdayLunch = plan.slots.find((slot) => slot.slotId === "2026-10-14#LUNCH");
    const dinner = plan.slots.find((slot) => slot.slotId === "2026-10-14#DINNER");
    const expected = (slot: typeof dinner, factors: number) => mealCost(slot?.dish?.cost ?? (undefined as never), factors, 2.5);
    expect(weekdayLunch?.cost).toBe(expected(weekdayLunch, 2));
    expect(dinner?.cost).toBe(expected(dinner, 2.5));
    const total = Math.round(plan.slots.reduce((sum, slot) => sum + (slot.cost ?? 0), 0) * 100) / 100;
    expect(plan.cost.total).toBe(total);
    expect(plan.cost.meals).toBe(plan.slots.filter((slot) => slot.dish).length);
    expect(plan.cost.perMeal).toBe(Math.round((total / plan.cost.meals) * 100) / 100);
    expect(plan.cost.total).toBeGreaterThan(10);
  });

  it("is zero before the plan exists, and tiers default to 6 and 10 EUR", async () => {
    expect((await setup().plans.getPlan("default", "current")).cost).toEqual({ total: 0, perMeal: null, meals: 0, complete: true });
    expect(DEFAULT_HOUSEHOLD_FOOD_RULES.costTiers).toEqual({ cheapMax: 6, mediumMax: 10 });
    expect(() => validate(foodProfileSchema, { eaters: [], household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, costTiers: { cheapMax: 10, mediumMax: 8 } } })).toThrow();
  });
});
