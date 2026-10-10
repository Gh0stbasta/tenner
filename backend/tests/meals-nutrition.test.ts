/** FOOD-012: nutrition estimate per adult portion. */

import { describe, expect, it } from "vitest";
import { createDishSchema, DEFAULT_HOUSEHOLD_FOOD_RULES, estimateNutrition, foodProfileSchema, IngredientService, roundNutrition, sumNutrition, toDishSummary } from "../src/meals/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";

const NOW = new Date("2026-10-10T10:00:00Z");
const catalog = () => new IngredientService(inMemoryMeals().store, () => NOW).ingredientsOf("default");

describe("estimateNutrition", () => {
  it("converts units (g, EL, pieces by weight) and rounds kcal to 10 and macros to grams", async () => {
    const estimate = estimateNutrition(
      {
        ingredients: [
          { ingredientId: "pasta", quantity: 125, unit: "g" },
          { ingredientId: "olive-oil", quantity: 1, unit: "EL" },
          { ingredientId: "egg", quantity: 2, unit: "Stück" },
        ],
      },
      await catalog(),
    );
    expect(estimate).toEqual({ kcal: 750, protein: 32, carbs: 90, fat: 29, estimated: true, source: "INGREDIENTS", complete: true, missingIngredients: [] });
  });

  it("leaves optional ingredients out", async () => {
    const map = await catalog();
    const without = estimateNutrition({ ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }] }, map);
    const withOptional = estimateNutrition({ ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }, { ingredientId: "olive-oil", quantity: 2, unit: "EL", optional: true }] }, map);
    expect(withOptional).toEqual(without);
  });

  it("lets the override win", async () => {
    const estimate = estimateNutrition({ ingredients: [{ ingredientId: "pasta", quantity: 125, unit: "g" }], nutritionOverride: { kcal: 523, protein: 20.4, carbs: 70.5, fat: 9.6 } }, await catalog());
    expect(estimate).toMatchObject({ kcal: 520, protein: 20, carbs: 71, fat: 10, source: "OVERRIDE", complete: true });
  });

  it("flags a partial result for unknown ingredients", async () => {
    const estimate = estimateNutrition({ ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }, { ingredientId: "gone", quantity: 50, unit: "g" }] }, await catalog());
    expect(estimate).toMatchObject({ kcal: 360, complete: false, missingIngredients: ["gone"] });
  });

  it("sums and rounds days", () => {
    expect(roundNutrition(sumNutrition([{ kcal: 404, protein: 10.4, carbs: 20.5, fat: 3 }, { kcal: 300, protein: 5, carbs: 5, fat: 2.4 }]))).toEqual({ kcal: 700, protein: 15, carbs: 26, fat: 5 });
    expect(sumNutrition([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("is part of dish summaries in plans", () => {
    const nutrition = { kcal: 500, protein: 20, carbs: 60, fat: 15, estimated: true as const, source: "INGREDIENTS" as const, complete: true, missingIngredients: [] };
    const summary = toDishSummary({ dishId: "d", name: "X", category: "PASTA", lightness: "LIGHT", temperature: "WARM", activeMinutes: 10, totalMinutes: 10, isVegetarian: true, favorite: false, archived: false, nutrition } as never);
    expect(summary.nutrition).toEqual(nutrition);
  });
});

describe("light lunch threshold", () => {
  it("defaults to 600 kcal and is validated", () => {
    expect(DEFAULT_HOUSEHOLD_FOOD_RULES.lightLunchMaxKcal).toBe(600);
    const { lightLunchMaxKcal: _ignored, ...withoutThreshold } = DEFAULT_HOUSEHOLD_FOOD_RULES;
    void _ignored;
    expect(validate(foodProfileSchema, { eaters: [], household: withoutThreshold }).household.lightLunchMaxKcal).toBe(600);
    expect(validate(foodProfileSchema, { eaters: [], household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, lightLunchMaxKcal: 750 } }).household.lightLunchMaxKcal).toBe(750);
    expect(() => validate(foodProfileSchema, { eaters: [], household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, lightLunchMaxKcal: 50 } })).toThrow();
  });
});

describe("nutrition override", () => {
  it("accepts portion values above 1000 kcal and rejects nonsense", () => {
    const base = { name: "Schnitzel", category: "MEAT_FISH", slots: ["DINNER"], lightness: "FILLING", temperature: "WARM", activeMinutes: 20, ingredients: [{ ingredientId: "pasta", quantity: 100, unit: "g" }] };
    expect(validate(createDishSchema, { ...base, nutritionOverride: { kcal: 1250, protein: 55, carbs: 90, fat: 70 } }).nutritionOverride?.kcal).toBe(1250);
    expect(() => validate(createDishSchema, { ...base, nutritionOverride: { kcal: 5000, protein: 1, carbs: 1, fat: 1 } })).toThrow();
    expect(() => validate(createDishSchema, { ...base, nutritionOverride: { kcal: 500, protein: -1, carbs: 1, fat: 1 } })).toThrow();
  });
});
