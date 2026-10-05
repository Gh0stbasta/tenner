/**
 * Neglected Tenners (ANALYTICS-006): how far each Tenner falls behind its own frequency. Pure functions; the formula
 * and its weights live only here (documented in docs/analytics.md).
 */

import type { Category, SkipEvent, Tenner, UserId, Vacation } from "../models/index.js";
import { isPaused } from "../utils/pause.js";
import { dateInTimeZone, daysBetween } from "../utils/timezone.js";
import { isActiveTenner, ratio, type AnalyticsContext } from "./aggregations.js";
import type { AnalyticsCompletion } from "./historyLoader.js";
import type { Period } from "./period.js";

export const DEFAULT_NEGLECTED_LIMIT = 10;
export const MAX_NEGLECTED_LIMIT = 50;

/** Weight of missed completions in the neglect score. */
export const NEGLECT_FULFILLMENT_WEIGHT = 0.6;
/** Weight of the current overdue time (relative to the frequency) in the neglect score. */
export const NEGLECT_OVERDUE_WEIGHT = 0.4;

export interface NeglectedTenner {
  readonly tennerId: string;
  readonly title: string;
  readonly assignedTo: UserId;
  readonly category: Category;
  readonly daysOverdue: number;
  /** Null if never completed. */
  readonly daysSinceCompleted: number | null;
  readonly expectedCompletions: number;
  readonly actualCompletions: number;
  readonly fulfillmentRatio: number;
  readonly neglectScore: number;
}

interface DateRange {
  readonly from: string;
  readonly to: string;
}

/** Days two inclusive ranges share. */
export function overlapDays(a: DateRange, b: DateRange): number {
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return from > to ? 0 : daysBetween(from, to) + 1;
}

const localDate = (timestamp: string, timezone: string): string => dateInTimeZone(new Date(timestamp), timezone);

const vacationCovers = (vacation: Vacation, category: Category): boolean => vacation.categories === null || vacation.categories.includes(category);

/**
 * Days of `window` on which the Tenner could be expected to be done: without the household vacation (if it covers the
 * category) and without its current individual pause (only the current pause is stored, SCHEDULING-005).
 */
export function expectedDays(tenner: Tenner, window: DateRange, vacation: Vacation | null, today: string, timezone: string): number {
  const total = daysBetween(window.from, window.to) + 1;
  const vacationDays = vacation && vacationCovers(vacation, tenner.category) ? overlapDays(window, { from: vacation.from, to: vacation.until }) : 0;
  const pauseDays = tenner.pausedAt !== null ? overlapDays(window, { from: localDate(tenner.pausedAt, timezone), to: tenner.pausedUntil ?? today }) : 0;
  return Math.max(0, total - vacationDays - pauseDays);
}

/**
 * Completions the Tenner should have had in the period: whole frequency intervals in its expected days (starting no
 * earlier than its creation), minus skipped occurrences (each skip excuses one cycle).
 */
export function expectedCompletions(tenner: Tenner, period: DateRange, skips: number, context: AnalyticsContext, timezone: string): number {
  const created = localDate(tenner.createdAt, timezone);
  const window = { from: created > period.from ? created : period.from, to: period.to };
  if (window.from > window.to) return 0;
  return Math.max(0, Math.floor(expectedDays(tenner, window, context.vacation, context.today, timezone) / tenner.frequencyDays) - skips);
}

/** Scores one active Tenner. */
export function scoreTenner(
  tenner: Tenner,
  completions: readonly AnalyticsCompletion[],
  skips: number,
  period: Period,
  context: AnalyticsContext,
  timezone: string,
): NeglectedTenner {
  const { today } = context;
  const paused = isPaused(tenner, context.vacation, today);
  const daysOverdue = paused ? 0 : Math.max(0, daysBetween(tenner.nextDue, today));
  const expected = expectedCompletions(tenner, period, skips, context, timezone);
  const actual = completions.length;
  // Never completed and older than one interval: fully neglected (unless it is paused right now).
  const abandoned = tenner.lastCompleted === null && !paused && daysBetween(localDate(tenner.createdAt, timezone), today) > tenner.frequencyDays;
  const fulfillment = abandoned ? 0 : expected === 0 ? 1 : Math.min(1, actual / expected);
  const score = abandoned
    ? 1
    : (1 - fulfillment) * NEGLECT_FULFILLMENT_WEIGHT + Math.min(daysOverdue / tenner.frequencyDays, 1) * NEGLECT_OVERDUE_WEIGHT;
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    assignedTo: tenner.assignedTo,
    category: tenner.category,
    daysOverdue,
    daysSinceCompleted: tenner.lastCompleted === null ? null : daysBetween(localDate(tenner.lastCompleted, timezone), today),
    expectedCompletions: expected,
    actualCompletions: actual,
    fulfillmentRatio: ratio(fulfillment, 1) ?? 0,
    neglectScore: ratio(score, 1) ?? 0,
  };
}

/**
 * GET /analytics/neglected: active Tenners with a neglect score above 0, highest first (ties: longer overdue, then
 * title), at most `limit`.
 */
export function neglectedTenners(
  completions: readonly AnalyticsCompletion[],
  skips: readonly SkipEvent[],
  tenners: readonly Tenner[],
  period: Period,
  context: AnalyticsContext,
  timezone: string,
  limit: number,
): NeglectedTenner[] {
  return tenners
    .filter(isActiveTenner)
    .map((tenner) =>
      scoreTenner(
        tenner,
        completions.filter((completion) => completion.tennerId === tenner.tennerId),
        skips.filter((skip) => skip.tennerId === tenner.tennerId).length,
        period,
        context,
        timezone,
      ),
    )
    .filter((item) => item.neglectScore > 0)
    .sort((a, b) => b.neglectScore - a.neglectScore || b.daysOverdue - a.daysOverdue || a.title.localeCompare(b.title))
    .slice(0, limit);
}
