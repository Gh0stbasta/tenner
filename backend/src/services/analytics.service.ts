import type { CompletionMetrics, DashboardResponse } from "../dto/index.js";

export interface AnalyticsService {
  getDashboard(tenantId: string, date: string): Promise<DashboardResponse>;
  getCompletionMetrics(tenantId: string, from: string, to: string): Promise<CompletionMetrics>;
}
