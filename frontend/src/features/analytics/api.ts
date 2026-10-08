/** GET /analytics/* (ANALYTICS-001 – 008) for the analytics page (ANALYTICS-009). Definitions: docs/analytics.md. */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { ApiError } from "../../api/errors";

export const PERIOD_OPTIONS = ["week", "month", "quarter", "year"] as const;
export type PeriodOption = (typeof PERIOD_OPTIONS)[number];

/** Selected period: a shortcut or a custom range (both dates inclusive). */
export type PeriodSelection = { readonly period: PeriodOption } | { readonly from: string; readonly to: string };

export type Granularity = "day" | "week" | "month";

const range = z.object({ from: z.string(), to: z.string() });
const nullableNumber = z.number().nullable();

const summarySchema = z.object({
  period: range,
  completions: z.number(),
  totalActualMinutes: z.number(),
  activeTenners: z.number(),
  distinctTennersCompleted: z.number(),
  overdueNow: z.number(),
  /** REC-001: occurrences nobody completed on their day; 0 from an API before REC-001. */
  missed: z.number().default(0),
  onTimeRate: nullableNumber,
  onTimeSamples: z.number(),
});
export type AnalyticsSummary = z.infer<typeof summarySchema>;

const trendsSchema = z.object({
  granularity: z.enum(["day", "week", "month"]),
  period: range,
  buckets: z.array(z.object({ start: z.string(), completions: z.number(), actualMinutes: z.number() })),
  comparison: z.object({ previousPeriod: range, previousPeriodCompletions: z.number(), changePercent: nullableNumber }),
});
export type AnalyticsTrends = z.infer<typeof trendsSchema>;

const categoriesSchema = z.object({
  period: range,
  categories: z.array(
    z.object({
      category: z.string(),
      name: z.string(),
      archived: z.boolean(),
      activeTenners: z.number(),
      completions: z.number(),
      actualMinutes: z.number(),
      shareOfMinutes: nullableNumber,
      overdueNow: z.number(),
      healthScore: nullableNumber,
    }),
  ),
});
export type AnalyticsCategories = z.infer<typeof categoriesSchema>;

const balanceSchema = z.object({
  period: range,
  byUser: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      shareOfMinutes: nullableNumber,
      shareOfAssignedLoad: nullableNumber,
    }),
  ),
  byCategory: z.array(
    z.object({ category: z.string(), name: z.string(), shares: z.record(z.string(), z.number()).nullable() }),
  ),
  balanceIndex: nullableNumber,
});
export type AnalyticsBalance = z.infer<typeof balanceSchema>;

const neglectedSchema = z.object({
  period: range,
  items: z.array(
    z.object({
      tennerId: z.string(),
      title: z.string(),
      assignedTo: z.string(),
      category: z.string(),
      daysOverdue: z.number(),
      daysSinceCompleted: nullableNumber,
      expectedCompletions: z.number(),
      actualCompletions: z.number(),
      fulfillmentRatio: z.number(),
      neglectScore: z.number(),
    }),
  ),
});
export type AnalyticsNeglected = z.infer<typeof neglectedSchema>;

const trendValue = z.enum(["IMPROVING", "STABLE", "DECLINING"]).nullable();
export type HabitTrend = z.infer<typeof trendValue>;

const habitsSchema = z.object({
  period: range,
  householdConsistency: nullableNumber,
  items: z.array(
    z.object({
      tennerId: z.string(),
      title: z.string(),
      currentStreak: z.number(),
      longestStreak: z.number(),
      consistencyScore: nullableNumber,
      trend: trendValue,
    }),
  ),
});
export type AnalyticsHabits = z.infer<typeof habitsSchema>;

const timeSchema = z.object({
  period: range,
  totalActualMinutes: z.number(),
  averageMinutesPerWeek: z.number(),
  projectedMinutesPerWeek: z.number(),
  estimationAccuracy: nullableNumber,
  reportedSamples: z.number(),
  tennersExceedingEstimate: z.array(
    z.object({
      tennerId: z.string(),
      title: z.string(),
      estimatedMinutes: z.number(),
      medianActualMinutes: z.number(),
      samples: z.number(),
    }),
  ),
  tennersExceedingTenMinutes: z.number(),
});
export type AnalyticsTime = z.infer<typeof timeSchema>;

/** Query string of a period selection. */
export function periodQuery(selection: PeriodSelection): Record<string, string> {
  return "period" in selection ? { period: selection.period } : { from: selection.from, to: selection.to };
}

/** True if the error means the endpoint is not deployed (yet): such sections are hidden, not shown broken. */
export const isUnavailable = (error: unknown): boolean => error instanceof ApiError && error.status === 404;

function useAnalytics<T>(name: string, schema: z.ZodType<T>, query: Record<string, string>) {
  return useQuery({
    queryKey: ["analytics", name, query],
    queryFn: () => apiClient.get(`/analytics/${name}`, { schema, query }),
    staleTime: 60_000,
  });
}

export const useAnalyticsSummary = (selection: PeriodSelection) =>
  useAnalytics("summary", summarySchema, periodQuery(selection));
export const useAnalyticsTrends = (selection: PeriodSelection, granularity: Granularity) =>
  useAnalytics("trends", trendsSchema, { ...periodQuery(selection), granularity });
export const useAnalyticsCategories = (selection: PeriodSelection) =>
  useAnalytics("categories", categoriesSchema, periodQuery(selection));
export const useAnalyticsBalance = (selection: PeriodSelection) =>
  useAnalytics("balance", balanceSchema, periodQuery(selection));
export const useAnalyticsNeglected = (selection: PeriodSelection) =>
  useAnalytics("neglected", neglectedSchema, periodQuery(selection));
export const useAnalyticsHabits = (selection: PeriodSelection) =>
  useAnalytics("habits", habitsSchema, periodQuery(selection));
export const useAnalyticsTime = (selection: PeriodSelection) =>
  useAnalytics("time", timeSchema, periodQuery(selection));
