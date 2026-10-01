/** PUT /tenners/{tennerId}: partial update of a Tenner (TICKET-011). */

import type { UpdateTennerRequest, UpdateTennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, tennerIdSchema, updateTennerSchema, validate } from "../validators/index.js";

export type UpdateTenner = (tenantId: string, tennerId: string, request: UpdateTennerRequest) => Promise<UpdateTennerResponse>;

export async function updateTennerHandler(event: ApiEvent, tenantId: string, updateTenner: UpdateTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const request = validate(updateTennerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const tenner = await updateTenner(tenantId, tennerId, request);
  logger.info("Tenner updated", { tennerId, changedFields: Object.keys(request), assignedTo: tenner.assignedTo });
  return successResponse(200, tenner);
}
