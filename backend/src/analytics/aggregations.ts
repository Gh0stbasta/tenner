/**
 * Pure analytics aggregations (ANALYTICS-001 ff.): no I/O, no clock. Metric definitions: docs/analytics.md.
 */

import type { Tenner, Vacation } from "../models/index.js";
import { isPaused } from "../utils/pause.js";
import type { AnalyticsCompletion } from "./historyLoader.js";
import type { Period } from "./period.js";

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
