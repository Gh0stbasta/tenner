/**
 * Dishes (FOOD-002): what the planner, shopping list, nutrition and cost features work with. Vegetarian, tags,
 * protein sources and base ingredients are derived from the ingredients (FOOD-021) on every read, so a changed
 * ingredient changes every dish that uses it.
 */

import type { BaseTag, IngredientTag, Nutrition, ProteinTag, QuantityUnit, ResolvedIngredient } from "./ingredient.js";
import { NON_VEGETARIAN_TAGS, toBaseQuantity } from "./ingredient.js";

export const DISH_CATEGORIES = ["PASTA", "POTATO", "RICE", "BURGER_WRAP", "MEAT_FISH", "VEGETARIAN", "SALAD", "SOUP", "SWEET", "SNACK"] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

export const MEAL_SLOTS = ["LUNCH", "DINNER"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const LIGHTNESS = ["LIGHT", "FILLING"] as const;
export type Lightness = (typeof LIGHTNESS)[number];

export const TEMPERATURES = ["WARM", "COLD"] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export interface DishIngredient {
  readonly ingredientId: string;
  /** Per adult portion; children's portions scale with the profile's portion factor (FOOD-004). */
  readonly quantity: number;
  readonly unit: QuantityUnit;
  /** Optional ingredients (e.g. Apfelmus to Kartoffelpuffer) do not count for allergies, diet and protein. */
  readonly optional: boolean;
}

/** Stored dish fields (item DISH#<dishId>). */
export interface Dish {
  readonly dishId: string;
  readonly name: string;
  /** Variants share a group; the planner uses at most one dish per group and week. */
  readonly group?: string;
  readonly category: DishCategory;
  readonly slots: readonly MealSlot[];
  readonly lightness: Lightness;
  readonly temperature: Temperature;
  readonly ingredients: readonly DishIngredient[];
  /** Hands-on cooking time (rule R4, EPIC-FOOD-001 decision 1). */
  readonly activeMinutes: number;
  /** Including oven and simmering time; shown only. */
  readonly totalMinutes: number;
  /** E.g. „mit Veggie-Patty“: makes a meat dish suitable for vegetarians (rule R2). */
  readonly vegetarianVariant?: string;
  readonly familyFriendly: boolean;
  /** Counts for the burger limit (rule R6). */
  readonly isBurger: boolean;
  /** Replace the derived values when the ingredients do not tell the truth (e.g. Frikadellen are MEATBALL). */
  readonly proteinSourcesOverride?: readonly ProteinTag[];
  readonly baseTagsOverride?: readonly BaseTag[];
  readonly nutritionOverride?: Nutrition;
  /** EUR for the whole family (FOOD-013). */
  readonly costOverride?: number;
  readonly favorite: boolean;
  /** Photo in the image bucket (FOOD-011); set by the upload flow only. */
  readonly imageKey?: string;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Values computed from the ingredients. */
export interface DishDerived {
  readonly isVegetarian: boolean;
  /** Tags of the required ingredients (allergens, diet, dislikes). */
  readonly tags: readonly IngredientTag[];
  /** Tags that only optional ingredients add. */
  readonly optionalTags: readonly IngredientTag[];
  readonly proteinSources: readonly ProteinTag[];
  readonly baseTags: readonly BaseTag[];
  readonly containsPoultry: boolean;
  /** Ingredients that no longer exist (e.g. a deleted household ingredient). */
  readonly unknownIngredients: readonly string[];
}

export type DishResponse = Dish & DishDerived;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** Derive diet, tags, protein and base from the dish's ingredients. */
export interface DerivableDish {
  /** `optional` may be missing (seed dishes): then the ingredient is required. */
  readonly ingredients: readonly (Pick<DishIngredient, "ingredientId"> & { readonly optional?: boolean | undefined })[];
  readonly proteinSourcesOverride?: readonly ProteinTag[] | null | undefined;
  readonly baseTagsOverride?: readonly BaseTag[] | null | undefined;
}

export function deriveDish(dish: DerivableDish, ingredients: ReadonlyMap<string, ResolvedIngredient>): DishDerived {
  const resolved = dish.ingredients.map((entry) => ({ entry, ingredient: ingredients.get(entry.ingredientId) }));
  const required = resolved.filter(({ entry, ingredient }) => !entry.optional && ingredient).map(({ ingredient }) => ingredient as ResolvedIngredient);
  const optional = resolved.filter(({ entry, ingredient }) => entry.optional && ingredient).map(({ ingredient }) => ingredient as ResolvedIngredient);
  const tags = unique(required.flatMap((ingredient) => ingredient.tags));
  const optionalTags = unique(optional.flatMap((ingredient) => ingredient.tags)).filter((tag) => !tags.includes(tag));
  const proteinSources = dish.proteinSourcesOverride ?? unique(required.flatMap((ingredient) => (ingredient.proteinTag ? [ingredient.proteinTag] : [])));
  const baseTags = dish.baseTagsOverride ?? unique(required.flatMap((ingredient) => (ingredient.baseTag ? [ingredient.baseTag] : [])));
  return {
    isVegetarian: !tags.some((tag) => NON_VEGETARIAN_TAGS.includes(tag)),
    tags,
    optionalTags,
    proteinSources,
    baseTags,
    containsPoultry: tags.includes("POULTRY") || proteinSources.includes("POULTRY"),
    unknownIngredients: resolved.filter(({ ingredient }) => !ingredient).map(({ entry }) => entry.ingredientId),
  };
}

/** Field errors for dish ingredients: unknown ingredients and units that cannot be converted. */
export function ingredientErrors(entries: readonly DishIngredient[], ingredients: ReadonlyMap<string, ResolvedIngredient>): { field: string; message: string }[] {
  return entries.flatMap((entry, index) => {
    const ingredient = ingredients.get(entry.ingredientId);
    if (!ingredient) return [{ field: `ingredients.${index}.ingredientId`, message: "Unknown ingredient." }];
    if (toBaseQuantity(entry.quantity, entry.unit, ingredient) === undefined) {
      return [{ field: `ingredients.${index}.unit`, message: `Unit ${entry.unit} does not fit ${ingredient.name} (${ingredient.unit}).` }];
    }
    return [];
  });
}
