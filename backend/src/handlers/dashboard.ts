/** GET /dashboard: due today, overdue, upcoming and summaries in one request (TICKET-016). */

import type { DashboardRequest, DashboardResponse } from "../dto/index.js";
import { ApplicationError, ValidationError } from "../exceptions/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { dashboardQuerySchema, validate } from "../validators/index.js";

export type GetDashboard = (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;

export async function dashboardHandler(event: ApiEvent, tenantId: string, getDashboard: GetDashboard, logger: Logger, now: () => number = Date.now): Promise<ApiResult> {
  const startedAt = now();
  let request: DashboardRequest;
  try {
    request = validate(dashboardQuerySchema, event.queryStringParameters ?? {});
  } catch (error) {
    throw error instanceof ValidationError ? new ValidationError("Invalid dashboard query.", error.details) : error;
  }

  try {
    const dashboard = await getDashboard(tenantId, request);
    logger.info("Dashboard requested", {
      event: "DashboardServed",
      referenceDate: dashboard.referenceDate,
      filters: { assignedTo: request.assignedTo, category: request.category, date: request.date },
      dueTodayCount: dashboard.summary.dueTodayCount,
      overdueCount: dashboard.summary.overdueCount,
      upcomingCount: dashboard.summary.upcomingCount,
      actionableCount: dashboard.summary.totalActionableCount,
      totalActionableMinutes: dashboard.summary.totalActionableMinutes,
      durationMs: now() - startedAt,
    });
    return successResponse(200, dashboard);
  } catch (error) {
    logger.warn("Dashboard failed", {
      event: "DashboardFailed",
      errorCode: error instanceof ApplicationError ? error.code : "INTERNAL_ERROR",
      durationMs: now() - startedAt,
    });
    throw error;
  }
}
