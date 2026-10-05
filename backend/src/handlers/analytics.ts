/** GET /analytics/* (ANALYTICS-001 ff.): validate the query, compute, log the period. */

import type { z } from "zod";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { validate } from "../validators/index.js";

/** Computes one analytics view for a tenant. */
export type AnalyticsQuery<TRequest, TResponse> = (tenantId: string, request: TRequest) => Promise<TResponse>;

/** Shared handler: query string → schema → service; logs the metric name and the requested period. */
export async function analyticsHandler<TRequest, TResponse>(
  metric: string,
  schema: z.ZodType<TRequest>,
  event: ApiEvent,
  tenantId: string,
  query: AnalyticsQuery<TRequest, TResponse>,
  logger: Logger,
): Promise<ApiResult> {
  const request = validate(schema, event.queryStringParameters ?? {});
  const response = await query(tenantId, request);
  logger.info("Analytics read", { event: "AnalyticsRead", metric, query: event.queryStringParameters ?? {} });
  return successResponse(200, response);
}
