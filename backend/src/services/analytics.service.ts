import type { CompletionMetrics, DashboardRequest, DashboardResponse } from "../dto/index.js";

export interface AnalyticsService {
  getDashboard(tenantId: string, request: DashboardRequest): Promise<DashboardResponse>;
  getCompletionMetrics(tenantId: string, from: string, to: string): Promise<CompletionMetrics>;
}
