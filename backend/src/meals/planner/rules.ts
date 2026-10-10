/**
 * Meal planning rules (FOOD-005): the household's rules R1 – R13 (EPIC-FOOD-001) as pure functions. The planner
 * (FOOD-006), replace (FOOD-007), manual choice (FOOD-022) and the plan page all use them; parameters come from the
 * family food profile (FOOD-004), never from constants here.
 */

import type { Weekday } from "../../models/enums.js";
import type { DishResponse, MealSlot } from "../models/dish.js";
import type { ProteinTag } from "../models/ingredient.js";
import { eatersAt, type Eater, type FoodProfile } from "../models/profile.js";
import { daysBetween, RECENT_DAYS, VERY_RECENT_DAYS } from "../history.js";

export const RULE_IDS = ["SLOT", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13"] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type Severity = "HARD" | "SOFT";

export interface Violation {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly slotIds: readonly string[];
  readonly message: string;
}

/** One meal of a week: date, weekday, lunch or dinner, and the planned dish (null = empty). */
export interface PlannedMeal {
  readonly slotId: string;
  readonly date: string;
  readonly weekday: Weekday;
  readonly slot: MealSlot;
  readonly dish: DishResponse | null;
}

/** History and preferences the soft rules use (FOOD-023 adds ratings). */
export interface RuleContext {
  /** Dishes eaten in the previous week (R12 soft). */
  readonly recentDishIds?: ReadonlySet<string>;
  /** Dishes the household rated 👎 (FOOD-023). */
  readonly dislikedDishIds?: ReadonlySet<string>;
  /** Dishes the household rated 👍 (FOOD-023). */
  readonly likedDishIds?: ReadonlySet<string>;
  /** Last date each dish was eaten before the week (FOOD-023); replaces recentDishIds when given. */
  readonly lastEaten?: ReadonlyMap<string, string>;
}

/** Days since the dish was last eaten before this meal, if within RECENT_DAYS (FOOD-023). */
export function recentlyEaten(meal: Pick<PlannedMeal, "date">, dishId: string, context: RuleContext): number | undefined {
  const last = context.lastEaten?.get(dishId);
  if (last === undefined) return undefined;
  const days = daysBetween(last, meal.date);
  return days > 0 && days <= RECENT_DAYS ? days : undefined;
}

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = { MON: "Montag", TUE: "Dienstag", WED: "Mittwoch", THU: "Donnerstag", FRI: "Freitag", SAT: "Samstag", SUN: "Sonntag" };
const SLOT_NAMES: Readonly<Record<MealSlot, string>> = { LUNCH: "mittags", DINNER: "abends" };
const PROTEIN_NAMES: Readonly<Record<ProteinTag, string>> = { POULTRY: "Geflügel", FISH: "Fisch", MINCE: "Hackfleisch", BURGER_PATTY: "Burger-Patty", SAUSAGE: "Würstchen", MEATBALL: "Hackbällchen", HAM: "Schinken" };
const WEEKEND: ReadonlySet<Weekday> = new Set(["SAT", "SUN"]);

/** Soft penalties for the planner score (larger = worse). */
export const SOFT_PENALTY: Readonly<Record<"R10" | "R11" | "R12", number>> = { R10: 3, R11: 4, R12: 2 };

const mealName = (meal: Pick<PlannedMeal, "weekday" | "slot">): string => `${WEEKDAY_NAMES[meal.weekday]} ${SLOT_NAMES[meal.slot]}`;
const hard = (rule: RuleId, slotIds: readonly string[], message: string): Violation => ({ rule, severity: "HARD", slotIds, message });
const soft = (rule: RuleId, slotIds: readonly string[], message: string): Violation => ({ rule, severity: "SOFT", slotIds, message });

/** Whether a vegetarian eater can eat the dish (R2). */
function suitsVegetarian(eater: Eater, dish: DishResponse): boolean {
  if (dish.isVegetarian || dish.vegetarianVariant !== undefined) return true;
  return dish.proteinSources.length > 0 && dish.proteinSources.every((source) => eater.vegetarianExceptions.includes(source));
}

function containsAny(dish: DishResponse, tags: readonly string[], ingredientIds: readonly string[]): boolean {
  return dish.tags.some((tag) => tags.includes(tag)) || dish.ingredients.some((entry) => !entry.optional && ingredientIds.includes(entry.ingredientId));
}

/**
 * Rules that concern one dish at one meal, independent of the rest of the week:
 * slot, R1 – R4, R5 (allowed meals), R9, R13.
 */
export function dishViolations(dish: DishResponse, meal: Pick<PlannedMeal, "slotId" | "weekday" | "slot">, profile: Pick<FoodProfile, "eaters" | "household">): Violation[] {
  const rules = profile.household;
  const at = [meal.slotId];
  const where = mealName(meal);
  const violations: Violation[] = [];
  if (!dish.slots.includes(meal.slot)) violations.push(hard("SLOT", at, `${dish.name} ist kein Gericht für ${SLOT_NAMES[meal.slot]}.`));
  const eaters = eatersAt(profile, meal.weekday, meal.slot);
  for (const eater of eaters) {
    if (dish.tags.some((tag) => eater.allergies.includes(tag))) violations.push(hard("R1", at, `${dish.name}: Allergie von ${eater.name}.`));
    if (eater.diet === "VEGETARIAN" && !suitsVegetarian(eater, dish)) violations.push(hard("R2", at, `${dish.name} passt nicht für ${eater.name} (vegetarisch).`));
    if (containsAny(dish, eater.dislikeTags, eater.dislikeIngredients)) violations.push(hard("R3", at, `${eater.name} mag ${dish.name} nicht.`));
  }
  if (containsAny(dish, rules.dislikeTags, rules.dislikeIngredients)) violations.push(hard("R3", at, `${dish.name} enthält etwas, das ihr nicht esst.`));
  if (dish.activeMinutes > rules.maxActiveMinutes) violations.push(hard("R4", at, `${dish.name} braucht ${dish.activeMinutes} Minuten (höchstens ${rules.maxActiveMinutes}).`));
  if (dish.containsPoultry && !rules.chicken.allowedSlots.includes(`${meal.weekday}#${meal.slot}`)) {
    violations.push(hard("R5", at, `Hühnchen nicht ${where}.`));
  }
  if (rules.lightLunchOnWeekdays && meal.slot === "LUNCH" && !WEEKEND.has(meal.weekday) && dish.lightness !== "LIGHT") {
    violations.push(hard("R9", at, `${where} soll leicht sein; ${dish.name} ist sättigend.`));
  }
  if (!dish.familyFriendly) violations.push(hard("R13", at, `${dish.name} ist nicht als familientauglich markiert.`));
  return violations;
}

/** Rules across the week: R5 (count), R6, R7, R8, R10, R11, R12. */
export function weekViolations(meals: readonly PlannedMeal[], profile: Pick<FoodProfile, "household">, context: RuleContext = {}): Violation[] {
  const rules = profile.household;
  const planned = meals.filter((meal): meal is PlannedMeal & { dish: DishResponse } => meal.dish !== null);
  const violations: Violation[] = [];
  const ids = (list: readonly { slotId: string }[]) => list.map((meal) => meal.slotId);

  const chicken = planned.filter((meal) => meal.dish.containsPoultry);
  if (chicken.length > rules.chicken.maxPerWeek) violations.push(hard("R5", ids(chicken), `Hühnchen höchstens ${rules.chicken.maxPerWeek}× pro Woche.`));

  const burgers = planned.filter((meal) => meal.dish.isBurger);
  if (burgers.length > rules.maxBurgerPerWeek) violations.push(hard("R6", ids(burgers), `Burger höchstens ${rules.maxBurgerPerWeek}× pro Woche.`));

  for (const tag of rules.limitedProteinTags) {
    const withTag = planned.filter((meal) => meal.dish.proteinSources.includes(tag));
    if (withTag.length > 1) violations.push(hard("R7", ids(withTag), `${PROTEIN_NAMES[tag]} nur einmal pro Woche.`));
  }

  const byDate = new Map<string, (PlannedMeal & { dish: DishResponse })[]>();
  for (const meal of planned) byDate.set(meal.date, [...(byDate.get(meal.date) ?? []), meal]);
  for (const sameDay of byDate.values()) {
    const [first, second] = sameDay;
    if (!first || !second) continue;
    const shared = first.dish.baseTags.filter((tag) => second.dish.baseTags.includes(tag));
    if (shared.length > 0) violations.push(hard("R8", ids(sameDay), `${WEEKDAY_NAMES[first.weekday]}: zweimal dieselbe Grundzutat.`));
  }

  const byDish = new Map<string, (PlannedMeal & { dish: DishResponse })[]>();
  const byGroup = new Map<string, (PlannedMeal & { dish: DishResponse })[]>();
  for (const meal of planned) {
    byDish.set(meal.dish.dishId, [...(byDish.get(meal.dish.dishId) ?? []), meal]);
    if (meal.dish.group) byGroup.set(meal.dish.group, [...(byGroup.get(meal.dish.group) ?? []), meal]);
  }
  for (const repeated of byDish.values()) if (repeated.length > 1) violations.push(hard("R12", ids(repeated), `${repeated[0]?.dish.name ?? "Gericht"} zweimal in einer Woche.`));
  for (const [group, repeated] of byGroup) {
    if (repeated.length > 1 && new Set(repeated.map((meal) => meal.dish.dishId)).size > 1) violations.push(hard("R12", ids(repeated), `Zwei Gerichte aus „${group}“ in einer Woche.`));
  }

  for (const meal of planned) {
    if (meal.slot === "DINNER" && (meal.dish.temperature === "COLD" || meal.dish.lightness === "LIGHT")) violations.push(soft("R10", [meal.slotId], `${mealName(meal)} lieber warm und sättigend.`));
    if (context.lastEaten) {
      const days = recentlyEaten(meal, meal.dish.dishId, context);
      if (days !== undefined) violations.push(soft("R12", [meal.slotId], `${meal.dish.name} gab es vor ${days === 1 ? "einem Tag" : `${days} Tagen`} schon.`));
    } else if (context.recentDishIds?.has(meal.dish.dishId)) violations.push(soft("R12", [meal.slotId], `${meal.dish.name} gab es letzte Woche schon.`));
  }

  const saladLunches = planned.filter((meal) => meal.slot === "LUNCH" && meal.dish.category === "SALAD");
  if (saladLunches.length > rules.maxSaladLunchesPerWeek * 2) {
    violations.push(hard("R11", ids(saladLunches), `Höchstens ${rules.maxSaladLunchesPerWeek * 2}× Salat mittags.`));
  } else if (saladLunches.length > rules.maxSaladLunchesPerWeek) {
    violations.push(soft("R11", ids(saladLunches), `Lieber höchstens ${rules.maxSaladLunchesPerWeek}× Salat mittags.`));
  }
  return violations;
}

/** All violations of a week. */
export function checkWeek(meals: readonly PlannedMeal[], profile: Pick<FoodProfile, "eaters" | "household">, context: RuleContext = {}): Violation[] {
  const perDish = meals.flatMap((meal) => (meal.dish ? dishViolations(meal.dish, meal, profile) : []));
  return [...perDish, ...weekViolations(meals, profile, context)];
}

/** Violations that involve one meal if `dish` is placed there (the rest of the week unchanged). */
export function checkSlot(meals: readonly PlannedMeal[], slotId: string, dish: DishResponse, profile: Pick<FoodProfile, "eaters" | "household">, context: RuleContext = {}): Violation[] {
  const placed = meals.map((meal) => (meal.slotId === slotId ? { ...meal, dish } : meal));
  return checkWeek(placed, profile, context).filter((violation) => violation.slotIds.includes(slotId));
}

export const hasHardViolation = (violations: readonly Violation[]): boolean => violations.some((violation) => violation.severity === "HARD");

/**
 * Plan quality (higher = better): soft rule penalties, bonus for favorites and the eaters' likes, penalty for dishes
 * rated 👎. Hard violations are not scored; the planner never accepts them.
 */
export function score(meals: readonly PlannedMeal[], profile: Pick<FoodProfile, "eaters" | "household">, context: RuleContext = {}): number {
  let total = 0;
  for (const violation of weekViolations(meals, profile, context)) {
    if (violation.severity === "SOFT") total -= SOFT_PENALTY[violation.rule as keyof typeof SOFT_PENALTY] ?? 1;
  }
  for (const meal of meals) {
    if (!meal.dish) {
      total -= 20;
      continue;
    }
    if (meal.dish.favorite) total += 1;
    if (context.likedDishIds?.has(meal.dish.dishId)) total += 1;
    if (context.dislikedDishIds?.has(meal.dish.dishId)) total -= 3;
    // FOOD-023: within 3 days counts double (the soft R12 violation above already costs SOFT_PENALTY.R12).
    const days = recentlyEaten(meal, meal.dish.dishId, context);
    if (days !== undefined && days <= VERY_RECENT_DAYS) total -= SOFT_PENALTY.R12;
    for (const eater of eatersAt(profile, meal.weekday, meal.slot)) {
      if (meal.dish.ingredients.some((entry) => eater.likeIngredients.includes(entry.ingredientId))) total += 0.5;
      if (meal.dish.group && eater.likeGroups.includes(meal.dish.group)) total += 0.5;
    }
  }
  return total;
}
