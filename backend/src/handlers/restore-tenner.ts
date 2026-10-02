/** POST /tenners/{tennerId}/restore: undo a soft delete (TICKET-015). */

import { actingUser, type Identity } from "../auth/index.js";
import type { RestoreTennerRequest } from "../dto/index.js";
import type { RestoreTennerOutcome } from "../services/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, restoreTennerSchema, tennerIdSchema, validate } from "../validators/index.js";

export type RestoreTenner = (identity: Identity, tennerId: string) => Promise<RestoreTennerOutcome>;

export async function restoreTennerHandler(event: ApiEvent, identity: Identity, restoreTenner: RestoreTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const request: RestoreTennerRequest = validate(restoreTennerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const restoredBy = actingUser(identity, request.restoredBy, "restoredBy");
  const { response, status, previousDeletedAt } = await restoreTenner(identity, tennerId);
  logger.info(status === "RESTORED" ? "Tenner restored" : "Tenner already active", {
    tennerId,
    restoredBy,
    previousDeletedAt,
  });
  return successResponse(200, response);
}
