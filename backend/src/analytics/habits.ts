/**
 * Habits and consistency (ANALYTICS-008): streaks and consistency relative to each Tenner's own frequency. Pure
 * functions; constants and formulas are documented in docs/analytics.md.
 */

import type { SkipEvent, Tenner } from "../models/index.js";
import { daysBetween } from "../utils/timezone.js";
import { isActiveTenner, ratio, type AnalyticsContext } from "./aggregations.js";
import type { AnalyticsCompletion } from "./historyLoader.js";
import { expectedCompletions } from "./neglect.js";
import { inPeriod, type Period } from "./period.js";

/** A completion keeps the streak if it follows the previous one within frequencyDays × this factor. */
export const STREAK_TOLERANCE = 1.25;
/** Consistency changes beyond ± this value count as IMPROVING or DECLINING. */
export const TREND_THRESHOLD = 0.1;
/** Streaks look back at most this many days (bounded history reads). */
export const STREAK_WINDOW_DAYS = 366;

export type HabitTrend = "IMPROVING" | "STABLE" | "DECLINING";

export interface HabitItem {
  readonly tennerId: string;
  readonly title: string;
  readonly currentStreak: number;
  readonly longestStreak: number;
  /** null with fewer than two completions in the period. */
  readonly consistencyScore: number | null;
  /** null when the current or previous period has too little data. */
  readonly trend: HabitTrend | null;
}

export interface HabitDetail extends HabitItem {
  readonly frequencyDays: number;
  readonly expectedCompletions: number;
  readonly actualCompletions: number;
  /** Household-local dates of the completions in the period, oldest first. */
  readonly completionDates: readonly string[];
  /** Days between consecutive completions in the period. */
  readonly intervals: readonly number[];
}

/** Days between consecutive completion dates (completions must be sorted oldest first). */
export function intervalsOf(dates: readonly string[]): number[] {
  return dates.slice(1).map((date, index) => daysBetween(dates[index] as string, date));
}

/** Coefficient of variation (population standard deviation ÷ mean), capped at 1; 0 for fewer than two intervals. */
export function normalizedVariance(intervals: readonly number[]): number {
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (mean === 0) return 1;
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  return Math.min(1, Math.sqrt(variance) / mean);
}

/**
 * Current and longest run of completions each within `frequencyDays × STREAK_TOLERANCE` of the previous one. The
 * current streak is 0 when the last completion is already longer ago than that.
 */
export function streaks(dates: readonly string[], frequencyDays: number, today: string): { current: number; longest: number } {
  const limit = frequencyDays * STREAK_TOLERANCE;
  let run = 0;
  let longest = 0;
  dates.forEach((date, index) => {
    run = index > 0 && daysBetween(dates[index - 1] as string, date) <= limit ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const last = dates.at(-1);
  return { current: last !== undefined && daysBetween(last, today) <= limit ? run : 0, longest };
}

/** fulfillmentRatio × (1 − normalized interval variance) over the period; null with fewer than two completions. */
export function consistency(tenner: Tenner, dates: readonly string[], skips: number, period: Period, context: AnalyticsContext, timezone: string): number | null {
  if (dates.length < 2) return null;
  const expected = expectedCompletions(tenner, period, skips, context, timezone);
  const fulfillment = expected === 0 ? 1 : Math.min(1, dates.length / expected);
  return ratio(fulfillment * (1 - normalizedVariance(intervalsOf(dates))), 1);
}

export function trendOf(current: number | null, previous: number | null): HabitTrend | null {
  if (current === null || previous === null) return null;
  if (current - previous > TREND_THRESHOLD) return "IMPROVING";
  return previous - current > TREND_THRESHOLD ? "DECLINING" : "STABLE";
}

/** Inputs shared by list and detail. Completions must be sorted oldest first and cover the streak window. */
export interface HabitInput {
  readonly completions: readonly AnalyticsCompletion[];
  readonly skips: readonly SkipEvent[];
  readonly period: Period;
  readonly previousPeriod: Period;
  readonly context: AnalyticsContext;
  readonly timezone: string;
}

/** Habit metrics of one Tenner. */
export function habitDetail(tenner: Tenner, input: HabitInput): HabitDetail {
  const own = input.completions.filter((completion) => completion.tennerId === tenner.tennerId);
  const skipsIn = (period: Period) => input.skips.filter((skip) => skip.tennerId === tenner.tennerId && inPeriod(skip.skippedDue, period)).length;
  const datesIn = (period: Period) => own.filter((completion) => inPeriod(completion.date, period)).map((completion) => completion.date);
  const dates = datesIn(input.period);
  const current = consistency(tenner, dates, skipsIn(input.period), input.period, input.context, input.timezone);
  const previous = consistency(tenner, datesIn(input.previousPeriod), skipsIn(input.previousPeriod), input.previousPeriod, input.context, input.timezone);
  const { current: currentStreak, longest } = streaks(
    own.map((completion) => completion.date),
    tenner.frequencyDays,
    input.context.today,
  );
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    currentStreak,
    longestStreak: longest,
    consistencyScore: current,
    trend: trendOf(current, previous),
    frequencyDays: tenner.frequencyDays,
    expectedCompletions: expectedCompletions(tenner, input.period, skipsIn(input.period), input.context, input.timezone),
    actualCompletions: dates.length,
    completionDates: dates,
    intervals: intervalsOf(dates),
  };
}

export interface HabitsMetrics {
  readonly period: { readonly from: string; readonly to: string };
  /** Mean consistency of active Tenners with a score (at least two completions); null if none. */
  readonly householdConsistency: number | null;
  /** Active Tenners, highest consistency first, Tenners without a score last (then by title). */
  readonly items: readonly HabitItem[];
}

/** GET /analytics/habits. */
export function habits(tenners: readonly Tenner[], input: HabitInput): HabitsMetrics {
  const items = tenners
    .filter(isActiveTenner)
    .map((tenner): HabitItem => {
      const { tennerId, title, currentStreak, longestStreak, consistencyScore, trend } = habitDetail(tenner, input);
      return { tennerId, title, currentStreak, longestStreak, consistencyScore, trend };
    })
    .sort((a, b) => (b.consistencyScore ?? -1) - (a.consistencyScore ?? -1) || a.title.localeCompare(b.title));
  const scores = items.flatMap((item) => (item.consistencyScore === null ? [] : [item.consistencyScore]));
  return {
    period: { from: input.period.from, to: input.period.to },
    householdConsistency: scores.length === 0 ? null : ratio(scores.reduce((sum, score) => sum + score, 0), scores.length),
    items,
  };
}
