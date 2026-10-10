/**
 * Food analytics (FOOD-019), computed on the fly from the stored plans (at most ~57 per year, TD-033 pattern): what
 * the family ate in the last 4 weeks, 12 weeks or year up to today — protein sources, vegetarian share, favorites,
 * rarely eaten dishes, cost per week, variety and how often the plan was followed.
 */

import type { WeekStart, Weekday } from "../models/enums.js";
import { addDays } from "../utils/clock.js";
import { mealCost } from "./cost.js";
import { effectiveStatus, type MealFeedback, type MealRecord } from "./history.js";
import type { DishResponse } from "./models/dish.js";
import { eatersAt, type FoodProfile } from "./models/profile.js";
import { weekStartOf } from "./planner/week.js";

export const FOOD_ANALYTICS_PERIODS = { "4w": 28, "12w": 84, "1y": 365 } as const;
export type FoodAnalyticsPeriod = keyof typeof FOOD_ANALYTICS_PERIODS;
export const TOP_LIMIT = 10;
export const NO_PROTEIN = "NONE";

export interface FoodAnalytics {
  readonly period: FoodAnalyticsPeriod;
  readonly from: string;
  readonly to: string;
  /** Meals eaten (cooked, or planned and not marked otherwise) in the period. */
  readonly meals: number;
  readonly protein: readonly { readonly tag: string; readonly count: number }[];
  /** Share 0–1 of eaten meals that are vegetarian (without variants); null without meals. */
  readonly vegetarianShare: number | null;
  readonly favorites: readonly { readonly dishId: string; readonly name: string; readonly count: number; readonly feedback: MealFeedback | null }[];
  readonly rarelyEaten: readonly { readonly dishId: string; readonly name: string }[];
  readonly cost: { readonly total: number; readonly perMeal: number | null; readonly weeks: readonly { readonly weekStart: string; readonly total: number }[] };
  readonly variety: { readonly distinctDishes: number; readonly meals: number; readonly repeats: readonly { readonly dishId: string; readonly name: string; readonly count: number }[] };
  /** Past meals by outcome. */
  readonly adherence: { readonly asPlanned: number; readonly replaced: number; readonly skipped: number; readonly other: number };
}

export interface FoodAnalyticsInput {
  readonly records: readonly MealRecord[];
  readonly dishes: readonly DishResponse[];
  readonly profile: Pick<FoodProfile, "eaters" | "household">;
  readonly today: string;
  readonly weekStartsOn: WeekStart;
  readonly period: FoodAnalyticsPeriod;
}

const WEEKDAYS: readonly Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const weekdayOf = (date: string): Weekday => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] as Weekday;
const cents = (value: number): number => Math.round(value * 100) / 100;

export function computeFoodAnalytics({ records, dishes, profile, today, weekStartsOn, period }: FoodAnalyticsInput): FoodAnalytics {
  const from = addDays(today, -(FOOD_ANALYTICS_PERIODS[period] - 1));
  const byId = new Map(dishes.map((dish) => [dish.dishId, dish]));
  const inPeriod = records.filter((record) => record.date >= from && record.date <= today).map((record) => ({ ...record, status: effectiveStatus(record, today) }));
  const eaten = inPeriod.filter((record) => (record.status === "COOKED" || record.status === "PLANNED") && byId.has(record.dishId));
  const dishOf = (record: MealRecord): DishResponse => byId.get(record.dishId) as DishResponse;

  const protein = new Map<string, number>();
  for (const record of eaten) {
    const sources = dishOf(record).proteinSources;
    for (const tag of sources.length > 0 ? sources : [NO_PROTEIN]) protein.set(tag, (protein.get(tag) ?? 0) + 1);
  }

  const counts = new Map<string, number>();
  for (const record of eaten) counts.set(record.dishId, (counts.get(record.dishId) ?? 0) + 1);
  const latestFeedback = new Map<string, { date: string; feedback: MealFeedback }>();
  for (const record of records) {
    if (!record.feedback) continue;
    const known = latestFeedback.get(record.dishId);
    if (!known || known.date <= record.date) latestFeedback.set(record.dishId, { date: record.date, feedback: record.feedback });
  }
  const feedbackOf = (dishId: string): MealFeedback | null => latestFeedback.get(dishId)?.feedback ?? null;
  const rank = (feedback: MealFeedback | null): number => (feedback === "UP" ? 1 : feedback === "DOWN" ? -1 : 0);
  const favorites = [...counts]
    .map(([dishId, count]) => ({ dishId, name: byId.get(dishId)?.name ?? dishId, count, feedback: feedbackOf(dishId) }))
    .sort((a, b) => b.count - a.count || rank(b.feedback) - rank(a.feedback) || a.name.localeCompare(b.name, "de"))
    .slice(0, TOP_LIMIT);

  const allFactors = profile.eaters.reduce((sum, eater) => sum + eater.portionFactor, 0);
  const weeks = new Map<string, number>();
  let total = 0;
  for (const record of eaten) {
    const slot = record.slotId.endsWith("#LUNCH") ? "LUNCH" : "DINNER";
    const present = eatersAt(profile, weekdayOf(record.date), slot).reduce((sum, eater) => sum + eater.portionFactor, 0);
    const cost = mealCost(dishOf(record).cost, present, allFactors);
    total += cost;
    const week = weekStartOf(record.date, weekStartsOn);
    weeks.set(week, (weeks.get(week) ?? 0) + cost);
  }

  const past = inPeriod.filter((record) => record.date < today || record.status !== "PLANNED");
  return {
    period,
    from,
    to: today,
    meals: eaten.length,
    protein: [...protein].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    vegetarianShare: eaten.length === 0 ? null : eaten.filter((record) => dishOf(record).isVegetarian).length / eaten.length,
    favorites,
    rarelyEaten: dishes
      .filter((dish) => !dish.archived && !counts.has(dish.dishId))
      .map((dish) => ({ dishId: dish.dishId, name: dish.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .slice(0, 20),
    cost: {
      total: cents(total),
      perMeal: eaten.length === 0 ? null : cents(total / eaten.length),
      weeks: [...weeks].map(([weekStart, sum]) => ({ weekStart, total: cents(sum) })).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    },
    variety: {
      distinctDishes: counts.size,
      meals: eaten.length,
      repeats: favorites.filter((entry) => entry.count > 1).slice(0, 5).map(({ dishId, name, count }) => ({ dishId, name, count })),
    },
    adherence: {
      asPlanned: past.filter((record) => (record.status === "COOKED" || record.status === "PLANNED") && record.source !== "MANUAL").length,
      replaced: past.filter((record) => (record.status === "COOKED" || record.status === "PLANNED") && record.source === "MANUAL").length,
      skipped: past.filter((record) => record.status === "SKIPPED").length,
      other: past.filter((record) => record.status === "OTHER").length,
    },
  };
}
