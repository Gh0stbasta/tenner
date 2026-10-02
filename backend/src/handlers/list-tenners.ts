/** GET /tenners: list Tenners with optional filters and sorting (TICKET-010). */

import type { ListTennersRequest, ListTennersResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { listTennersQuerySchema, validate } from "../validators/index.js";

export type ListTenners = (tenantId: string, request: ListTennersRequest) => Promise<ListTennersResponse>;

export async function listTennersHandler(event: ApiEvent, tenantId: string, listTenners: ListTenners, logger: Logger): Promise<ApiResult> {
  const request = validate(listTennersQuerySchema, event.queryStringParameters ?? {});
  logger.info("List Tenners request", { filters: request });
  const tenners = await listTenners(tenantId, request);
  logger.info("List Tenners result", { count: tenners.length });
  return successResponse(200, tenners);
}
