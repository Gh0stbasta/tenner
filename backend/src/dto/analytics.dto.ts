/** GET /analytics/* contracts (ANALYTICS-001 ff.). Metric definitions: docs/analytics.md. */

import type { PeriodRequest } from "../analytics/period.js";
import type { SummaryMetrics } from "../analytics/aggregations.js";

/** Query of every period-based analytics endpoint. */
export type AnalyticsPeriodRequest = PeriodRequest;

export type AnalyticsSummaryResponse = SummaryMetrics;
