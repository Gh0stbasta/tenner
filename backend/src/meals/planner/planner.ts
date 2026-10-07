/**
 * Weekly planner (FOOD-006): fills the free meals of a week with dishes so that no hard rule (FOOD-005) is broken
 * and the soft rules score best. Deterministic for the same input and seed: a seeded random order, a depth-first
 * search with backtracking (most constrained meal first) and several attempts; the best scoring complete plan wins.
 * A meal no dish can fill stays empty with a reason; a plan never breaks a hard rule.
 */

import type { DishResponse } from "../models/dish.js";
import type { FoodProfile } from "../models/profile.js";
import { checkSlot, dishViolations, hasHardViolation, score, type PlannedMeal, type RuleContext, type RuleId } from "./rules.js";
import { emptyWeek } from "./week.js";

export interface PlanInput {
  readonly weekStart: string;
  /** Active dishes with derived values. */
  readonly dishes: readonly DishResponse[];
  readonly profile: Pick<FoodProfile, "eaters" | "household">;
  /** Meals that must keep their dish (locked, chosen by hand, past or cooked; FOOD-008, FOOD-022). */
  readonly fixed?: ReadonlyMap<string, DishResponse | null>;
  readonly context?: RuleContext;
  readonly seed: number;
  readonly attempts?: number;
  /** Upper bound of search steps per attempt (keeps a Lambda run short). */
  readonly stepLimit?: number;
}

export interface PlannedSlot {
  readonly slotId: string;
  readonly dishId: string | null;
  /** Why the planner left the meal empty. */
  readonly emptyReason?: string;
}

export interface PlanResult {
  readonly slots: readonly PlannedSlot[];
  readonly score: number;
  /** True when every free meal got a dish. */
  readonly complete: boolean;
}

const RULE_REASONS: Readonly<Record<RuleId, string>> = {
  SLOT: "nicht für diese Mahlzeit",
  R1: "Allergien",
  R2: "vegetarisch",
  R3: "Abneigungen",
  R4: "Kochzeit",
  R5: "Hühnchen-Regel",
  R6: "Burger-Regel",
  R7: "Proteinquelle schon in der Woche",
  R8: "Grundzutat schon an dem Tag",
  R9: "mittags leicht",
  R10: "abends warm",
  R11: "Salat-Regel",
  R12: "schon in der Woche",
  R13: "nicht familientauglich",
};

/** Mulberry32: small, fast, seedable PRNG; enough for shuffling. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

/** „Kein Gericht passt (meist: mittags leicht)“: the rule that rules out most dishes at that meal. */
function emptyReason(meals: readonly PlannedMeal[], meal: PlannedMeal, input: PlanInput): string {
  if (input.dishes.length === 0) return "Noch keine Gerichte angelegt.";
  const counts = new Map<RuleId, number>();
  for (const dish of input.dishes) {
    const first = checkSlot(meals, meal.slotId, dish, input.profile, input.context).find((violation) => violation.severity === "HARD");
    if (first) counts.set(first.rule, (counts.get(first.rule) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? `Kein Gericht passt (meist: ${RULE_REASONS[top[0]]}).` : "Kein Gericht passt.";
}

interface Attempt {
  readonly meals: PlannedMeal[];
  readonly complete: boolean;
}

function attempt(base: readonly PlannedMeal[], free: readonly PlannedMeal[], candidates: ReadonlyMap<string, readonly DishResponse[]>, input: PlanInput, random: () => number): Attempt {
  const meals = base.map((meal) => ({ ...meal }));
  const indexOf = new Map(meals.map((meal, index) => [meal.slotId, index]));
  const order = [...free].sort((a, b) => (candidates.get(a.slotId)?.length ?? 0) - (candidates.get(b.slotId)?.length ?? 0));
  const options = new Map(order.map((meal) => [meal.slotId, shuffled(candidates.get(meal.slotId) ?? [], random)]));
  const stepLimit = input.stepLimit ?? 4000;
  let steps = 0;

  const fits = (slotId: string, dish: DishResponse): boolean => !hasHardViolation(checkSlot(meals, slotId, dish, input.profile, input.context));
  const place = (slotId: string, dish: DishResponse | null) => {
    const index = indexOf.get(slotId) as number;
    meals[index] = { ...(meals[index] as PlannedMeal), dish };
  };

  const search = (position: number): boolean => {
    const meal = order[position];
    if (!meal) return true;
    for (const dish of options.get(meal.slotId) ?? []) {
      if ((steps += 1) > stepLimit) return false;
      if (!fits(meal.slotId, dish)) continue;
      place(meal.slotId, dish);
      if (search(position + 1)) return true;
      place(meal.slotId, null);
    }
    return false;
  };

  if (search(0)) return { meals, complete: true };
  // Greedy fallback: fill what fits, leave the rest empty.
  for (const meal of order) place(meal.slotId, null);
  for (const meal of order) {
    const dish = (options.get(meal.slotId) ?? []).find((candidate) => fits(meal.slotId, candidate));
    if (dish) place(meal.slotId, dish);
  }
  return { meals, complete: false };
}

export function plan(input: PlanInput): PlanResult {
  const fixed = input.fixed ?? new Map<string, DishResponse | null>();
  const base = emptyWeek(input.weekStart).map((meal) => ({ ...meal, dish: fixed.get(meal.slotId) ?? null }));
  const free = base.filter((meal) => !fixed.has(meal.slotId));
  const candidates = new Map(free.map((meal) => [meal.slotId, input.dishes.filter((dish) => !hasHardViolation(dishViolations(dish, meal, input.profile)))]));

  let best: { meals: PlannedMeal[]; complete: boolean; score: number } | undefined;
  const attempts = Math.max(1, input.attempts ?? 6);
  for (let index = 0; index < attempts; index += 1) {
    const result = attempt(base, free, candidates, input, seededRandom(input.seed + index * 7919));
    const value = score(result.meals, input.profile, input.context);
    const better = !best || (result.complete && !best.complete) || (result.complete === best.complete && value > best.score);
    if (better) best = { ...result, score: value };
  }
  const chosen = best as { meals: PlannedMeal[]; complete: boolean; score: number };
  const slots = chosen.meals.map((meal): PlannedSlot => {
    if (meal.dish || fixed.has(meal.slotId)) return { slotId: meal.slotId, dishId: meal.dish?.dishId ?? null };
    return { slotId: meal.slotId, dishId: null, emptyReason: emptyReason(chosen.meals, meal, input) };
  });
  return { slots, score: chosen.score, complete: chosen.complete };
}
