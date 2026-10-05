/** GET /analytics/* contracts (ANALYTICS-001 ff.). Metric definitions: docs/analytics.md. */

import type { HabitDetail, HabitsMetrics } from "../analytics/habits.js";
import type { NeglectedTenner } from "../analytics/neglect.js";
import type { PeriodRequest } from "../analytics/period.js";
import type { BalanceMetrics, CategoriesMetrics, TimeMetrics, Granularity, SummaryMetrics, TennerFilter, TrendMetrics, UsersMetrics } from "../analytics/aggregations.js";

/** Query of every period-based analytics endpoint. */
export type AnalyticsPeriodRequest = PeriodRequest;

export type AnalyticsSummaryResponse = SummaryMetrics;

/** GET /analytics/trends (ANALYTICS-002). */
export interface AnalyticsTrendsRequest extends PeriodRequest, TennerFilter {
  readonly granularity?: Granularity | undefined;
}

export type AnalyticsTrendsResponse = TrendMetrics;

/** GET /analytics/users (ANALYTICS-003). */
export type AnalyticsUsersResponse = UsersMetrics;

/** GET /analytics/categories (ANALYTICS-004). */
export type AnalyticsCategoriesResponse = CategoriesMetrics;

/** GET /analytics/neglected (ANALYTICS-006). */
export interface AnalyticsNeglectedRequest extends PeriodRequest {
  /** 1–50, default 10. */
  readonly limit?: number | undefined;
}

export interface AnalyticsNeglectedResponse {
  readonly period: { readonly from: string; readonly to: string };
  readonly items: readonly NeglectedTenner[];
}

/** GET /analytics/balance (ANALYTICS-007). */
export type AnalyticsBalanceResponse = BalanceMetrics;

/** GET /analytics/habits (ANALYTICS-008). */
export type AnalyticsHabitsResponse = HabitsMetrics;

/** GET /analytics/habits/{tennerId} (ANALYTICS-008). */
export interface AnalyticsHabitResponse extends HabitDetail {
  readonly period: { readonly from: string; readonly to: string };
}

/** GET /analytics/time (ANALYTICS-005). */
export type AnalyticsTimeResponse = TimeMetrics;
