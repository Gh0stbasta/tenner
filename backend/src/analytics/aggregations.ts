/**
 * Pure analytics aggregations (ANALYTICS-001 ff.): no I/O, no clock. Metric definitions: docs/analytics.md.
 */

import { SHARED_ASSIGNEE, type Category, type HouseholdCategory, type HouseholdMember, type SkipEvent, type Tenner, type UserId, type Vacation, type WeekStart } from "../models/index.js";
import { addDays } from "../utils/clock.js";
import { addMonths } from "../utils/schedule.js";
import { isPaused } from "../utils/pause.js";
import type { AnalyticsCompletion } from "./historyLoader.js";
import { inPeriod, startOfMonth, startOfWeek, type Period } from "./period.js";

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
  /** REC-001: occurrences in the period nobody completed on their day (the notifier moved them on). */
  readonly missed: number;
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
export function summarize(completions: readonly AnalyticsCompletion[], tenners: readonly Tenner[], period: Period, context: AnalyticsContext, skips: readonly SkipEvent[] = []): SummaryMetrics {
  const timed = completions.filter((completion) => completion.previousNextDue !== undefined);
  const onTime = timed.filter((completion) => completion.date <= (completion.previousNextDue ?? "")).length;
  return {
    period: { from: period.from, to: period.to },
    completions: completions.length,
    totalActualMinutes: sumMinutes(completions),
    activeTenners: tenners.filter(isActiveTenner).length,
    distinctTennersCompleted: new Set(completions.map((completion) => completion.tennerId)).size,
    overdueNow: tenners.filter((tenner) => isOverdue(tenner, context)).length,
    missed: skips.filter((skip) => skip.missed && inPeriod(skip.skippedDue, period)).reduce((sum, skip) => sum + (skip.missedCount ?? 1), 0),
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

export interface UserMetrics {
  readonly userId: UserId;
  readonly displayName: string;
  /** False for deactivated members (HOUSEHOLD-ADMIN-004); they stay listed for their history. */
  readonly active: boolean;
  readonly completions: number;
  readonly actualMinutes: number;
  readonly assignedActive: number;
  readonly assignedOverdue: number;
  readonly completedForOthers: number;
}

export interface UsersMetrics {
  readonly period: { readonly from: string; readonly to: string };
  readonly users: readonly UserMetrics[];
  /** Shared Tenners (HOUSEHOLD-002) are nobody's own; their counts are reported separately. */
  readonly shared: { readonly assignedActive: number; readonly assignedOverdue: number };
}

/**
 * GET /analytics/users (ANALYTICS-003): one entry per household member (members list = single source of truth),
 * including members without activity. Completions count for `completedBy`; assignments use the current assignee.
 */
export function userMetrics(
  completions: readonly AnalyticsCompletion[],
  tenners: readonly Tenner[],
  members: readonly HouseholdMember[],
  period: Period,
  context: AnalyticsContext,
): UsersMetrics {
  const tennersById = new Map(tenners.map((tenner) => [tenner.tennerId, tenner]));
  const active = tenners.filter(isActiveTenner);
  const assigned = (userId: UserId) => active.filter((tenner) => tenner.assignedTo === userId);
  const overdue = (list: readonly Tenner[]) => list.filter((tenner) => isOverdue(tenner, context)).length;
  return {
    period: { from: period.from, to: period.to },
    users: members.map((member) => {
      const own = completions.filter((completion) => completion.completedBy === member.userId);
      const mine = assigned(member.userId);
      return {
        userId: member.userId,
        displayName: member.displayName,
        active: member.active,
        completions: own.length,
        actualMinutes: sumMinutes(own),
        assignedActive: mine.length,
        assignedOverdue: overdue(mine),
        // Tenners assigned to another member now; shared and deleted Tenners are nobody else's.
        completedForOthers: own.filter((completion) => {
          const assignee = tennersById.get(completion.tennerId)?.assignedTo;
          return assignee !== undefined && assignee !== member.userId && assignee !== SHARED_ASSIGNEE;
        }).length,
      };
    }),
    shared: { assignedActive: assigned(SHARED_ASSIGNEE).length, assignedOverdue: overdue(assigned(SHARED_ASSIGNEE)) },
  };
}

export interface CategoryMetrics {
  readonly category: Category;
  readonly name: string;
  readonly archived: boolean;
  readonly activeTenners: number;
  readonly completions: number;
  readonly actualMinutes: number;
  /** Category minutes ÷ minutes of all categories; null without minutes. */
  readonly shareOfMinutes: number | null;
  readonly overdueNow: number;
  /** 1 − overdue ÷ active Tenners; null without active Tenners. */
  readonly healthScore: number | null;
}

export interface CategoriesMetrics {
  readonly period: { readonly from: string; readonly to: string };
  readonly categories: readonly CategoryMetrics[];
}

/**
 * GET /analytics/categories (ANALYTICS-004): every household category in display order (archived ones too), grouped
 * by the Tenner's current category. Completions of deleted Tenners have no category and are left out.
 */
export function categoryMetrics(
  completions: readonly AnalyticsCompletion[],
  tenners: readonly Tenner[],
  categories: readonly HouseholdCategory[],
  period: Period,
  context: AnalyticsContext,
): CategoriesMetrics {
  const categoryOf = new Map(tenners.map((tenner) => [tenner.tennerId, tenner.category]));
  const minutesOf = (category: Category) => sumMinutes(completions.filter((completion) => categoryOf.get(completion.tennerId) === category));
  const known = new Set(categories.map((category) => category.categoryId));
  const totalMinutes = sumMinutes(completions.filter((completion) => known.has(categoryOf.get(completion.tennerId) ?? "")));
  return {
    period: { from: period.from, to: period.to },
    categories: [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => {
        const id = category.categoryId;
        const active = tenners.filter((tenner) => isActiveTenner(tenner) && tenner.category === id);
        const overdue = active.filter((tenner) => isOverdue(tenner, context)).length;
        const minutes = minutesOf(id);
        return {
          category: id,
          name: category.name,
          archived: category.archived,
          activeTenners: active.length,
          completions: completions.filter((completion) => categoryOf.get(completion.tennerId) === id).length,
          actualMinutes: minutes,
          shareOfMinutes: ratio(minutes, totalMinutes),
          overdueNow: overdue,
          healthScore: active.length === 0 ? null : ratio(active.length - overdue, active.length),
        };
      }),
  };
}

/** Expected minutes per week of a Tenner: estimatedMinutes × 7 ÷ frequencyDays (ANALYTICS-005, ANALYTICS-007). */
export const projectedWeeklyMinutes = (tenner: Tenner): number => (tenner.estimatedMinutes * 7) / tenner.frequencyDays;

export interface BalanceUser {
  readonly userId: UserId;
  readonly displayName: string;
  /** Member's minutes (completedBy) ÷ all minutes in the period; null without minutes. */
  readonly shareOfMinutes: number | null;
  /** Member's projected weekly minutes (assignedTo, shared Tenners split evenly) ÷ all; null without load. */
  readonly shareOfAssignedLoad: number | null;
}

export interface BalanceMetrics {
  readonly period: { readonly from: string; readonly to: string };
  /** In member-list order (no ranking). */
  readonly byUser: readonly BalanceUser[];
  /** Per household category: share of the category's minutes per member, or null without minutes. */
  readonly byCategory: readonly { readonly category: Category; readonly name: string; readonly shares: Readonly<Record<UserId, number>> | null }[];
  /** 1 − (largest − smallest shareOfMinutes); null without minutes. */
  readonly balanceIndex: number | null;
}

/**
 * GET /analytics/balance (ANALYTICS-007). Members: the active ones plus deactivated members with minutes in the
 * period. Shared Tenners (HOUSEHOLD-002) count equally for every active member, as on the dashboard.
 */
export function balance(
  completions: readonly AnalyticsCompletion[],
  tenners: readonly Tenner[],
  members: readonly HouseholdMember[],
  categories: readonly HouseholdCategory[],
  period: Period,
): BalanceMetrics {
  const minutesBy = (list: readonly AnalyticsCompletion[], userId: UserId) => sumMinutes(list.filter((completion) => completion.completedBy === userId));
  const included = members.filter((member) => member.active || minutesBy(completions, member.userId) > 0);
  const activeMembers = members.filter((member) => member.active).length;
  const active = tenners.filter(isActiveTenner);
  const loadOf = (userId: UserId, isActive: boolean) =>
    active.reduce((sum, tenner) => {
      if (tenner.assignedTo === userId) return sum + projectedWeeklyMinutes(tenner);
      return tenner.assignedTo === SHARED_ASSIGNEE && isActive && activeMembers > 0 ? sum + projectedWeeklyMinutes(tenner) / activeMembers : sum;
    }, 0);
  const totalMinutes = included.reduce((sum, member) => sum + minutesBy(completions, member.userId), 0);
  const loads = included.map((member) => loadOf(member.userId, member.active));
  const totalLoad = loads.reduce((sum, load) => sum + load, 0);
  const byUser = included.map((member, index) => ({
    userId: member.userId,
    displayName: member.displayName,
    shareOfMinutes: ratio(minutesBy(completions, member.userId), totalMinutes),
    shareOfAssignedLoad: ratio(loads[index] ?? 0, totalLoad),
  }));
  const categoryOf = new Map(tenners.map((tenner) => [tenner.tennerId, tenner.category]));
  const shares = byUser.map((user) => user.shareOfMinutes ?? 0);
  return {
    period: { from: period.from, to: period.to },
    byUser,
    byCategory: [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => {
        const inCategory = completions.filter((completion) => categoryOf.get(completion.tennerId) === category.categoryId);
        const total = included.reduce((sum, member) => sum + minutesBy(inCategory, member.userId), 0);
        return {
          category: category.categoryId,
          name: category.name,
          shares: total === 0 ? null : Object.fromEntries(included.map((member) => [member.userId, ratio(minutesBy(inCategory, member.userId), total) ?? 0])),
        };
      }),
    balanceIndex: totalMinutes === 0 ? null : ratio(1 - (Math.max(...shares) - Math.min(...shares)), 1),
  };
}

/** A Tenner's median exceeds its estimate by this factor (ANALYTICS-005). */
export const ESTIMATE_EXCEEDED_FACTOR = 1.5;
/** Minimum user-reported completions before a Tenner can exceed its estimate. */
export const MIN_ESTIMATE_SAMPLES = 3;
/** "Ten-Minute First": estimates above this count as long Tenners. */
export const TEN_MINUTES = 10;

export interface TennerExceedingEstimate {
  readonly tennerId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly medianActualMinutes: number;
  readonly samples: number;
}

export interface TimeMetrics {
  readonly period: { readonly from: string; readonly to: string };
  readonly totalActualMinutes: number;
  /** totalActualMinutes ÷ (period days ÷ 7), rounded. */
  readonly averageMinutesPerWeek: number;
  /** Σ projected weekly minutes of active Tenners, rounded. */
  readonly projectedMinutesPerWeek: number;
  /** Σ estimated ÷ Σ actual over user-reported completions; null without any. */
  readonly estimationAccuracy: number | null;
  /** Completions with user-reported minutes in the period. */
  readonly reportedSamples: number;
  readonly tennersExceedingEstimate: readonly TennerExceedingEstimate[];
  readonly tennersExceedingTenMinutes: number;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * GET /analytics/time (ANALYTICS-005). Accuracy and exceeding estimates use only user-reported minutes
 * (`actualMinutesSource = USER`); defaults and older records are left out. Estimates are the Tenners' current ones.
 */
export function timeInvestment(completions: readonly AnalyticsCompletion[], tenners: readonly Tenner[], period: Period): TimeMetrics {
  const byId = new Map(tenners.map((tenner) => [tenner.tennerId, tenner]));
  const reported = completions.filter((completion) => completion.actualMinutesSource === "USER" && byId.has(completion.tennerId));
  const estimated = reported.reduce((sum, completion) => sum + (byId.get(completion.tennerId)?.estimatedMinutes ?? 0), 0);
  const active = tenners.filter(isActiveTenner);
  const exceeding = [...new Set(reported.map((completion) => completion.tennerId))].flatMap((tennerId): TennerExceedingEstimate[] => {
    const tenner = byId.get(tennerId) as Tenner;
    const samples = reported.filter((completion) => completion.tennerId === tennerId).map((completion) => completion.actualMinutes);
    const medianActual = median(samples);
    return samples.length >= MIN_ESTIMATE_SAMPLES && medianActual > tenner.estimatedMinutes * ESTIMATE_EXCEEDED_FACTOR
      ? [{ tennerId, title: tenner.title, estimatedMinutes: tenner.estimatedMinutes, medianActualMinutes: medianActual, samples: samples.length }]
      : [];
  });
  const total = sumMinutes(completions);
  return {
    period: { from: period.from, to: period.to },
    totalActualMinutes: total,
    averageMinutesPerWeek: Math.round(total / (period.days / 7)),
    projectedMinutesPerWeek: Math.round(active.reduce((sum, tenner) => sum + projectedWeeklyMinutes(tenner), 0)),
    estimationAccuracy: ratio(estimated, sumMinutes(reported)),
    reportedSamples: reported.length,
    tennersExceedingEstimate: exceeding.sort((a, b) => b.medianActualMinutes / b.estimatedMinutes - a.medianActualMinutes / a.estimatedMinutes),
    tennersExceedingTenMinutes: active.filter((tenner) => tenner.estimatedMinutes > TEN_MINUTES).length,
  };
}
