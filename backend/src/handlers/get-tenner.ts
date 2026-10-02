/** GET /tenners/{tennerId}: read one Tenner (TICKET-019). */

import type { TennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { getTennerQuerySchema, tennerIdSchema, validate } from "../validators/index.js";

export type GetTenner = (tenantId: string, tennerId: string, options: { includeDeleted?: boolean | undefined }) => Promise<TennerResponse>;

export async function getTennerHandler(event: ApiEvent, tenantId: string, getTenner: GetTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const { includeDeleted } = validate(getTennerQuerySchema, event.queryStringParameters ?? {});
  const tenner = await getTenner(tenantId, tennerId, { includeDeleted });
  logger.info("Tenner read", { tennerId, includeDeleted: includeDeleted === true });
  return successResponse(200, tenner);
}
