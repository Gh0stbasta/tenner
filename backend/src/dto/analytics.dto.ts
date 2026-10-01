/**
 * Initial analytics contracts used by the AnalyticsService interface.
 * TICKET-016 (dashboard) and the ANALYTICS domain finalize the fields.
 */

import type { TennerResponse } from "./tenner.dto.js";

export interface DashboardResponse {
  /** Calendar date (YYYY-MM-DD) the dashboard was computed for. */
  readonly date: string;
  readonly dueToday: readonly TennerResponse[];
  readonly overdue: readonly TennerResponse[];
  readonly upcoming: readonly TennerResponse[];
  readonly estimatedMinutesToday: number;
}

export interface CompletionMetrics {
  readonly from: string;
  readonly to: string;
  readonly completions: number;
  readonly totalActualMinutes: number;
}
