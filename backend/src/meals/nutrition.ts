/**
 * Nutrition estimate (FOOD-012): per adult portion from the ingredients' values per 100 g; optional ingredients are
 * left out, a dish's nutritionOverride wins. Rough by design („Grobe Schätzung, keine Ernährungsberatung.“).
 */

import type { DishIngredient } from "./models/dish.js";
import { toGrams, type Nutrition, type ResolvedIngredient } from "./models/ingredient.js";

export interface NutritionEstimate extends Nutrition {
  readonly estimated: true;
  readonly source: "INGREDIENTS" | "OVERRIDE";
  /** False when ingredients without usable values were left out (unknown, or pieces without a weight). */
  readonly complete: boolean;
  readonly missingIngredients: readonly string[];
}

export interface NutritionSource {
  readonly ingredients: readonly (Pick<DishIngredient, "ingredientId" | "quantity" | "unit"> & { readonly optional?: boolean | undefined })[];
  readonly nutritionOverride?: Nutrition | null | undefined;
}

/** kcal to 10, macros to whole grams. */
export function roundNutrition(value: Nutrition): Nutrition {
  return { kcal: Math.round(value.kcal / 10) * 10, protein: Math.round(value.protein), carbs: Math.round(value.carbs), fat: Math.round(value.fat) };
}

export function sumNutrition(values: readonly Nutrition[]): Nutrition {
  return values.reduce((sum, value) => ({ kcal: sum.kcal + value.kcal, protein: sum.protein + value.protein, carbs: sum.carbs + value.carbs, fat: sum.fat + value.fat }), {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
}

export function estimateNutrition(dish: NutritionSource, ingredients: ReadonlyMap<string, ResolvedIngredient>): NutritionEstimate {
  if (dish.nutritionOverride) return { ...roundNutrition(dish.nutritionOverride), estimated: true, source: "OVERRIDE", complete: true, missingIngredients: [] };
  const parts: Nutrition[] = [];
  const missing: string[] = [];
  for (const entry of dish.ingredients) {
    if (entry.optional) continue;
    const ingredient = ingredients.get(entry.ingredientId);
    const grams = ingredient ? toGrams(entry.quantity, entry.unit, ingredient) : undefined;
    if (!ingredient || grams === undefined) {
      missing.push(entry.ingredientId);
      continue;
    }
    const factor = grams / 100;
    const per100 = ingredient.nutritionPer100g;
    parts.push({ kcal: per100.kcal * factor, protein: per100.protein * factor, carbs: per100.carbs * factor, fat: per100.fat * factor });
  }
  return { ...roundNutrition(sumNutrition(parts)), estimated: true, source: "INGREDIENTS", complete: missing.length === 0, missingIngredients: missing };
}
