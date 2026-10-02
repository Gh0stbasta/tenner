/**
 * Analytics contracts used by the AnalyticsService interface. The dashboard contracts live in
 * dashboard.dto.ts (TICKET-016); completion metrics are finalized by the ANALYTICS domain.
 */

export interface CompletionMetrics {
  readonly from: string;
  readonly to: string;
  readonly completions: number;
  readonly totalActualMinutes: number;
}
