/**
 * Cost estimate (FOOD-013): EUR per adult portion from the ingredients' prices (per 100 g / 100 ml or per piece),
 * scaled by the portion factors of the people who eat. Pantry ingredients (salt, oil …) count with a small flat amount
 * per meal instead of their quantity. A dish's costOverride (EUR for the whole family) wins.
 */

import type { DishIngredient } from "./models/dish.js";
import { toBaseQuantity, type ResolvedIngredient } from "./models/ingredient.js";

/** Flat amount per pantry ingredient and meal (EUR, whole family). */
export const PANTRY_FLAT_EUR = 0.1;

export interface DishCost {
  /** EUR per adult portion without pantry items; null with an override. */
  readonly perAdultPortion: number | null;
  /** EUR per meal for pantry ingredients (independent of the number of eaters). */
  readonly pantry: number;
  /** EUR for the whole family when set by hand. */
  readonly familyOverride: number | null;
  readonly source: "INGREDIENTS" | "OVERRIDE";
  readonly estimated: true;
  readonly complete: boolean;
  readonly missingIngredients: readonly string[];
}

export interface CostSource {
  readonly ingredients: readonly (Pick<DishIngredient, "ingredientId" | "quantity" | "unit"> & { readonly optional?: boolean | undefined })[];
  readonly costOverride?: number | null | undefined;
}

const cents = (value: number): number => Math.round(value * 100) / 100;

export function estimateCost(dish: CostSource, ingredients: ReadonlyMap<string, ResolvedIngredient>): DishCost {
  if (typeof dish.costOverride === "number") {
    return { perAdultPortion: null, pantry: 0, familyOverride: cents(dish.costOverride), source: "OVERRIDE", estimated: true, complete: true, missingIngredients: [] };
  }
  let perPortion = 0;
  let pantry = 0;
  const missing: string[] = [];
  for (const entry of dish.ingredients) {
    if (entry.optional) continue;
    const ingredient = ingredients.get(entry.ingredientId);
    const base = ingredient ? toBaseQuantity(entry.quantity, entry.unit, ingredient) : undefined;
    if (!ingredient || base === undefined) {
      missing.push(entry.ingredientId);
      continue;
    }
    if (ingredient.pantry) pantry += PANTRY_FLAT_EUR;
    else perPortion += ingredient.unit === "Stück" ? base * ingredient.pricePerUnit : (base / 100) * ingredient.pricePerUnit;
  }
  return {
    perAdultPortion: cents(perPortion),
    pantry: cents(pantry),
    familyOverride: null,
    source: "INGREDIENTS",
    estimated: true,
    complete: missing.length === 0,
    missingIngredients: missing,
  };
}

/**
 * EUR of a meal for eaters with these portion factors. An override is for the whole family (all factors) and is
 * scaled to the eaters present.
 */
export function mealCost(cost: DishCost, presentFactors: number, allFactors: number): number {
  if (cost.familyOverride !== null) return cents(allFactors > 0 ? (cost.familyOverride * presentFactors) / allFactors : cost.familyOverride);
  return cents((cost.perAdultPortion ?? 0) * presentFactors + cost.pantry);
}
