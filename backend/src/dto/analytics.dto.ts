/** GET /analytics/* contracts (ANALYTICS-001 ff.). Metric definitions: docs/analytics.md. */

import type { PeriodRequest } from "../analytics/period.js";
import type { Granularity, SummaryMetrics, TennerFilter, TrendMetrics, UsersMetrics } from "../analytics/aggregations.js";

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
