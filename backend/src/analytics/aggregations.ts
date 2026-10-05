/**
 * Pure analytics aggregations (ANALYTICS-001 ff.): no I/O, no clock. Metric definitions: docs/analytics.md.
 */

import type { Category, Tenner, UserId, Vacation, WeekStart } from "../models/index.js";
import { addDays } from "../utils/clock.js";
import { addMonths } from "../utils/schedule.js";
import { isPaused } from "../utils/pause.js";
import type { AnalyticsCompletion } from "./historyLoader.js";
import { startOfMonth, startOfWeek, type Period } from "./period.js";

/** Facts every aggregation may need besides the data. */
export interface AnalyticsContext {
  /** Household-local today. */
  readonly today: string;
  readonly vacation: Vacation | null;
}

export interface SummaryMetrics {
  readonly period: { readonly from: string; readonly to: string };
  readonly completions: number;
  readonly totalActualMinutes: number;
  readonly activeTenners: number;
  readonly distinctTennersCompleted: number;
  readonly overdueNow: number;
  /** Share of completions on or before their due date; null without completions that recorded the due date. */
  readonly onTimeRate: number | null;
  /** Completions the on-time rate is based on. */
  readonly onTimeSamples: number;
}

/** Active, not deleted. */
export const isActiveTenner = (tenner: Tenner): boolean => tenner.active && tenner.deletedAt === null;

/** Active Tenner whose due date has passed and that is not paused (individually or by the vacation). */
export const isOverdue = (tenner: Tenner, context: AnalyticsContext): boolean =>
  isActiveTenner(tenner) && tenner.nextDue < context.today && !isPaused(tenner, context.vacation, context.today);

export const sumMinutes = (completions: readonly AnalyticsCompletion[]): number => completions.reduce((sum, completion) => sum + completion.actualMinutes, 0);

/** Ratio rounded to 4 decimals, or null when the denominator is 0. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;
}

/** GET /analytics/summary. `completions` are already limited to the period. */
export function summarize(completions: readonly AnalyticsCompletion[], tenners: readonly Tenner[], period: Period, context: AnalyticsContext): SummaryMetrics {
  const timed = completions.filter((completion) => completion.previousNextDue !== undefined);
  const onTime = timed.filter((completion) => completion.date <= (completion.previousNextDue ?? "")).length;
  return {
    period: { from: period.from, to: period.to },
    completions: completions.length,
    totalActualMinutes: sumMinutes(completions),
    activeTenners: tenners.filter(isActiveTenner).length,
    distinctTennersCompleted: new Set(completions.map((completion) => completion.tennerId)).size,
    overdueNow: tenners.filter((tenner) => isOverdue(tenner, context)).length,
    onTimeRate: ratio(onTime, timed.length),
    onTimeSamples: timed.length,
  };
}

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Optional filters on the completed Tenner's current assignee and category (ANALYTICS-002). */
export interface TennerFilter {
  readonly assignedTo?: UserId | undefined;
  readonly category?: Category | undefined;
}

export interface TrendBucket {
  /** First day of the day, week or month. */
  readonly start: string;
  readonly completions: number;
  readonly actualMinutes: number;
}

export interface TrendMetrics {
  readonly granularity: Granularity;
  readonly period: { readonly from: string; readonly to: string };
  readonly buckets: readonly TrendBucket[];
  readonly comparison: {
    readonly previousPeriod: { readonly from: string; readonly to: string };
    readonly previousPeriodCompletions: number;
    /** Change against the previous period in percent (1 decimal); null if the previous period had none. */
    readonly changePercent: number | null;
  };
}

/** Completions whose Tenner matches the filter. Without a filter, completions of deleted Tenners count too. */
export function filterCompletions(completions: readonly AnalyticsCompletion[], tennersById: ReadonlyMap<string, Tenner>, filter: TennerFilter): AnalyticsCompletion[] {
  if (filter.assignedTo === undefined && filter.category === undefined) return [...completions];
  return completions.filter((completion) => {
    const tenner = tennersById.get(completion.tennerId);
    return (
      tenner !== undefined &&
      (filter.assignedTo === undefined || tenner.assignedTo === filter.assignedTo) &&
      (filter.category === undefined || tenner.category === filter.category)
    );
  });
}

/** Start of the bucket containing `date`. */
export function bucketStart(date: string, granularity: Granularity, weekStartsOn: WeekStart): string {
  if (granularity === "day") return date;
  return granularity === "week" ? startOfWeek(date, weekStartsOn) : startOfMonth(date);
}

const nextBucket = (start: string, granularity: Granularity): string =>
  granularity === "day" ? addDays(start, 1) : granularity === "week" ? addDays(start, 7) : addMonths(start, 1);

/**
 * GET /analytics/trends: zero-filled buckets over the period (the first bucket may start before `period.from`; only
 * days inside the period count) and the comparison with the previous period. Inputs are already filtered.
 */
export function trends(
  current: readonly AnalyticsCompletion[],
  previous: readonly AnalyticsCompletion[],
  period: Period,
  previousPeriod: Period,
  granularity: Granularity,
  weekStartsOn: WeekStart,
): TrendMetrics {
  const buckets = new Map<string, { completions: number; actualMinutes: number }>();
  for (let start = bucketStart(period.from, granularity, weekStartsOn); start <= period.to; start = nextBucket(start, granularity)) {
    buckets.set(start, { completions: 0, actualMinutes: 0 });
  }
  for (const completion of current) {
    const bucket = buckets.get(bucketStart(completion.date, granularity, weekStartsOn));
    if (!bucket) continue;
    bucket.completions += 1;
    bucket.actualMinutes += completion.actualMinutes;
  }
  const change = ratio(current.length - previous.length, previous.length);
  return {
    granularity,
    period: { from: period.from, to: period.to },
    buckets: [...buckets].map(([start, bucket]) => ({ start, ...bucket })),
    comparison: {
      previousPeriod: { from: previousPeriod.from, to: previousPeriod.to },
      previousPeriodCompletions: previous.length,
      changePercent: change === null ? null : Math.round(change * 1000) / 10,
    },
  };
}
