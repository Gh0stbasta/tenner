/**
 * Meal history and feedback (FOOD-023): what was really eaten and what the household liked, read from the stored
 * weekly plans (kept about a year by the table's TTL). A past meal without a status counts as cooked after two days.
 */

import { addDays } from "../utils/clock.js";
import type { SlotStatus } from "./models/plan.js";

export const FEEDBACK = ["UP", "DOWN"] as const;
export type MealFeedback = (typeof FEEDBACK)[number];

/** A planned meal that is two days old without a status counts as cooked. */
export const AUTO_COOKED_AFTER_DAYS = 2;
/** Recent repeats the planner avoids: within 7 days, stronger within 3 (FOOD-023). */
export const RECENT_DAYS = 7;
export const VERY_RECENT_DAYS = 3;
export const STATS_DAYS = 90;

export interface MealRecord {
  readonly slotId: string;
  readonly date: string;
  readonly dishId: string;
  readonly status: SlotStatus;
  readonly feedback?: MealFeedback;
}

export function effectiveStatus(record: Pick<MealRecord, "date" | "status">, today: string): SlotStatus {
  return record.status === "PLANNED" && record.date <= addDays(today, -AUTO_COOKED_AFTER_DAYS) ? "COOKED" : record.status;
}

/** Eaten (or still planned to be eaten): not skipped and not replaced by something else. */
const eaten = (record: MealRecord): boolean => record.status === "COOKED" || record.status === "PLANNED";

export interface HistoryContext {
  /** Last date each dish was eaten before the week. */
  readonly lastEaten: ReadonlyMap<string, string>;
  readonly likedDishIds: ReadonlySet<string>;
  readonly dislikedDishIds: ReadonlySet<string>;
}

/** The latest feedback per dish wins. */
function feedbackByDish(records: readonly MealRecord[]): Map<string, MealFeedback> {
  const latest = new Map<string, { date: string; feedback: MealFeedback }>();
  for (const record of records) {
    if (!record.feedback) continue;
    const known = latest.get(record.dishId);
    if (!known || known.date <= record.date) latest.set(record.dishId, { date: record.date, feedback: record.feedback });
  }
  return new Map([...latest].map(([dishId, entry]) => [dishId, entry.feedback]));
}

/** What the planner needs for the week starting at `weekStart`. */
export function historyContext(records: readonly MealRecord[], weekStart: string): HistoryContext {
  const lastEaten = new Map<string, string>();
  for (const record of records) {
    if (record.date >= weekStart || !eaten(record)) continue;
    const known = lastEaten.get(record.dishId);
    if (!known || known < record.date) lastEaten.set(record.dishId, record.date);
  }
  const feedback = feedbackByDish(records);
  return {
    lastEaten,
    likedDishIds: new Set([...feedback].filter(([, value]) => value === "UP").map(([dishId]) => dishId)),
    dislikedDishIds: new Set([...feedback].filter(([, value]) => value === "DOWN").map(([dishId]) => dishId)),
  };
}

/** Days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface DishHistory {
  readonly dishId: string;
  readonly lastEaten: string | null;
  readonly timesLast90Days: number;
  readonly feedback: MealFeedback | null;
}

/** Per dish: last eaten (up to today), how often in the last 90 days, latest feedback. */
export function dishHistory(records: readonly MealRecord[], today: string): DishHistory[] {
  const feedback = feedbackByDish(records);
  const since = addDays(today, -STATS_DAYS);
  const byDish = new Map<string, { lastEaten: string | null; times: number }>();
  for (const record of records) {
    const entry = byDish.get(record.dishId) ?? { lastEaten: null, times: 0 };
    if (record.date <= today && eaten({ ...record, status: effectiveStatus(record, today) })) {
      if (entry.lastEaten === null || entry.lastEaten < record.date) entry.lastEaten = record.date;
      if (record.date > since) entry.times += 1;
    }
    byDish.set(record.dishId, entry);
  }
  return [...byDish].map(([dishId, entry]) => ({ dishId, lastEaten: entry.lastEaten, timesLast90Days: entry.times, feedback: feedback.get(dishId) ?? null }));
}
