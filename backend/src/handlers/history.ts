/** GET /history and GET /tenners/{tennerId}/history (TICKET-020). */

import type { HistoryRequest, HistoryResponse, TennerHistoryRequest } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { historyQuerySchema, tennerHistoryQuerySchema, tennerIdSchema, validate } from "../validators/index.js";

export type GetHistory = (tenantId: string, request: HistoryRequest) => Promise<HistoryResponse>;
export type GetTennerHistory = (tenantId: string, tennerId: string, request: TennerHistoryRequest) => Promise<HistoryResponse>;

export async function historyHandler(event: ApiEvent, tenantId: string, getHistory: GetHistory, logger: Logger): Promise<ApiResult> {
  const request = validate(historyQuerySchema, event.queryStringParameters ?? {});
  const history = await getHistory(tenantId, request);
  logger.info("History read", {
    filters: { from: request.from, to: request.to, completedBy: request.completedBy, includeUndone: request.includeUndone },
    count: history.items.length,
    hasMore: history.nextCursor !== null,
  });
  return successResponse(200, history);
}

export async function tennerHistoryHandler(event: ApiEvent, tenantId: string, getTennerHistory: GetTennerHistory, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const request = validate(tennerHistoryQuerySchema, event.queryStringParameters ?? {});
  const history = await getTennerHistory(tenantId, tennerId, request);
  logger.info("Tenner history read", { tennerId, count: history.items.length, hasMore: history.nextCursor !== null });
  return successResponse(200, history);
}
