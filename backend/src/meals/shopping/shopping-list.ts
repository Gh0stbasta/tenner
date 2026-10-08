/**
 * Shopping list (FOOD-014): pure functions from a week plan to a list of ingredients, the refresh merge and the
 * changes people make (tick off, own items, own order). The service stores the result as LIST#<weekStart>.
 */

import type { DishResponse } from "../models/dish.js";
import { SHOPPING_SECTIONS, toBaseQuantity, type IngredientUnit, type ResolvedIngredient, type ShoppingSection } from "../models/ingredient.js";
import type { StoredPlanSlot } from "../models/plan.js";
import { eatersAt, type FoodProfile } from "../models/profile.js";
import { emptyWeek } from "../planner/week.js";

/** REST: from today to the end of the week (default); WEEK: every planned meal of the week. */
export const SHOPPING_RANGES = ["REST", "WEEK"] as const;
export type ShoppingRange = (typeof SHOPPING_RANGES)[number];

export interface ShoppingItem {
  /** Ingredient ID for planned items, `manual-<id>` for own items. */
  readonly key: string;
  readonly ingredientId: string | null;
  readonly name: string;
  /** FOOD-028: a count („2×“), no weights; null for own items. */
  readonly quantity: number | null;
  /** FOOD-028: "Stück" for generated items (lists stored before FOOD-028 may hold "g"/"ml", see normalizeItem). */
  readonly unit: IngredientUnit | null;
  readonly section: ShoppingSection;
  /** Basic supply (salt, oil): shown collapsed, not subtracted from a stock. */
  readonly pantry: boolean;
  readonly checked: boolean;
  readonly manual: boolean;
  /** Meals that need it (slot IDs), for „für Mo Abend, Do Mittag“. */
  readonly usedFor: readonly string[];
}

export interface StoredShoppingList {
  readonly weekStart: string;
  readonly range: ShoppingRange;
  readonly generatedAt: string;
  /** Fingerprint of the generated items; differs from a fresh generation when the plan changed. */
  readonly signature: string;
  /** In the household's order (drag and drop); ticked items are shown at the end by the clients. */
  readonly items: readonly ShoppingItem[];
}

/** Changes from the clients; each is idempotent, so a replayed offline queue does no harm. */
export type ShoppingOperation =
  | { readonly type: "check"; readonly key: string; readonly checked: boolean }
  | { readonly type: "add"; readonly key: string; readonly name: string }
  | { readonly type: "remove"; readonly key: string }
  | { readonly type: "move"; readonly key: string; readonly afterKey: string | null };

export const MANUAL_KEY_PREFIX = "manual-";

export interface GenerationInput {
  readonly weekStart: string;
  readonly slots: readonly StoredPlanSlot[];
  readonly dishes: ReadonlyMap<string, DishResponse>;
  readonly ingredients: ReadonlyMap<string, ResolvedIngredient>;
  readonly profile: Pick<FoodProfile, "eaters" | "household">;
  /** Meals before this date are left out (REST: today). */
  readonly from: string;
}

/**
 * FOOD-028 (owner decision 2026-10-08): the list shows counts only, no grams or millilitres. Pieces are rounded up
 * („3× Zwiebeln“); weighed ingredients count once per meal that needs them („2× Hackfleisch“), since the catalog
 * has no pack sizes.
 */
export function countOf(quantity: number, unit: IngredientUnit, meals: number): number {
  if (unit === "Stück") return Math.max(1, Math.ceil(quantity - 1e-9));
  return Math.max(1, meals);
}

/** Items of lists stored before FOOD-028 carry grams or millilitres; they are shown as counts too. */
export function normalizeItem(item: ShoppingItem): ShoppingItem {
  if (item.quantity === null || item.unit === null || item.unit === "Stück") return item;
  return { ...item, quantity: countOf(item.quantity, item.unit, item.usedFor.length), unit: "Stück" };
}

const sectionIndex = (section: ShoppingSection): number => SHOPPING_SECTIONS.indexOf(section);

/** Section order, pantry items last, then by name. */
function compareItems(a: ShoppingItem, b: ShoppingItem): number {
  return Number(a.pantry) - Number(b.pantry) || sectionIndex(a.section) - sectionIndex(b.section) || a.name.localeCompare(b.name, "de");
}

/**
 * Ingredients of the planned meals from `from` on: quantity per adult portion × the portion factors of the eaters
 * at that meal, summed per ingredient in its base unit and turned into a count (FOOD-028). Optional ingredients, cooked or skipped meals
 * and meals without eaters are left out.
 */
export function generateItems(input: GenerationInput): ShoppingItem[] {
  const meals = new Map(emptyWeek(input.weekStart).map((meal) => [meal.slotId, meal]));
  const totals = new Map<string, { ingredient: ResolvedIngredient; quantity: number; usedFor: string[] }>();
  for (const slot of input.slots) {
    const meal = meals.get(slot.slotId);
    const dish = slot.dishId ? input.dishes.get(slot.dishId) : undefined;
    if (!meal || !dish || slot.status !== "PLANNED" || meal.date < input.from) continue;
    const portions = eatersAt(input.profile, meal.weekday, meal.slot).reduce((sum, eater) => sum + eater.portionFactor, 0);
    if (portions <= 0) continue;
    for (const part of dish.ingredients) {
      const ingredient = input.ingredients.get(part.ingredientId);
      const base = ingredient && !part.optional ? toBaseQuantity(part.quantity, part.unit, ingredient) : undefined;
      if (!ingredient || base === undefined) continue;
      const total = totals.get(ingredient.ingredientId) ?? { ingredient, quantity: 0, usedFor: [] };
      total.quantity += base * portions;
      if (!total.usedFor.includes(slot.slotId)) total.usedFor.push(slot.slotId);
      totals.set(ingredient.ingredientId, total);
    }
  }
  return [...totals.values()]
    .map(({ ingredient, quantity, usedFor }) => ({
      key: ingredient.ingredientId,
      ingredientId: ingredient.ingredientId,
      name: ingredient.name,
      quantity: countOf(quantity, ingredient.unit, usedFor.length),
      unit: "Stück" as const,
      section: ingredient.shoppingSection,
      pantry: ingredient.pantry,
      checked: false,
      manual: false,
      usedFor: [...usedFor].sort(),
    }))
    .sort(compareItems);
}

/** Fingerprint of generated items (what, how much, for which meals). */
export function signatureOf(items: readonly ShoppingItem[]): string {
  return JSON.stringify(
    items
      .filter((item) => !item.manual)
      .map((item) => [item.key, item.quantity, item.usedFor.join(",")])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

/**
 * Refresh after plan changes: own items, ticks and the own order stay; planned items get new quantities; items no
 * longer needed go; new items are placed after the last item of their section (or where the section belongs).
 */
export function mergeRefresh(current: readonly ShoppingItem[], generated: readonly ShoppingItem[]): ShoppingItem[] {
  const fresh = new Map(generated.map((item) => [item.key, item]));
  const result: ShoppingItem[] = [];
  for (const item of current) {
    if (item.manual) {
      result.push(item);
      continue;
    }
    const update = fresh.get(item.key);
    if (update) result.push({ ...update, checked: item.checked });
  }
  const known = new Set(result.map((item) => item.key));
  for (const item of generated) {
    if (known.has(item.key)) continue;
    result.splice(insertionIndex(result, item), 0, item);
  }
  return result;
}

/** After the last item of the same section; without one, after the last item that sorts before it. */
function insertionIndex(items: readonly ShoppingItem[], item: ShoppingItem): number {
  let sameSection = -1;
  let before = -1;
  items.forEach((other, position) => {
    if (other.manual) return;
    if (other.section === item.section && other.pantry === item.pantry) sameSection = position;
    if (compareItems(other, item) <= 0) before = position;
  });
  return (sameSection >= 0 ? sameSection : before) + 1;
}

/** Apply changes in order; unknown keys are ignored (the item may have gone with a refresh). */
export function applyOperations(items: readonly ShoppingItem[], operations: readonly ShoppingOperation[]): ShoppingItem[] {
  let result = [...items];
  for (const operation of operations) {
    switch (operation.type) {
      case "check":
        result = result.map((item) => (item.key === operation.key ? { ...item, checked: operation.checked } : item));
        break;
      case "add":
        if (!result.some((item) => item.key === operation.key)) {
          result.push({ key: operation.key, ingredientId: null, name: operation.name, quantity: null, unit: null, section: "SONSTIGES", pantry: false, checked: false, manual: true, usedFor: [] });
        }
        break;
      case "remove":
        result = result.filter((item) => item.key !== operation.key);
        break;
      case "move": {
        const moving = result.find((item) => item.key === operation.key);
        if (!moving || operation.afterKey === operation.key) break;
        const rest = result.filter((item) => item.key !== operation.key);
        const anchor = operation.afterKey === null ? -1 : rest.findIndex((item) => item.key === operation.afterKey);
        if (operation.afterKey !== null && anchor < 0) break;
        rest.splice(anchor + 1, 0, moving);
        result = rest;
        break;
      }
    }
  }
  return result;
}
