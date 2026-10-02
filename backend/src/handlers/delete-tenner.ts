/** DELETE /tenners/{tennerId}: soft delete a Tenner (TICKET-012). */

import type { Identity } from "../auth/index.js";
import type { DeleteTennerResult } from "../services/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { tennerIdSchema, validate } from "../validators/index.js";

export type DeleteTenner = (identity: Identity, tennerId: string) => Promise<DeleteTennerResult>;

export async function deleteTennerHandler(event: ApiEvent, identity: Identity, deleteTenner: DeleteTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const { response, outcome } = await deleteTenner(identity, tennerId);
  logger.info(outcome.status === "DELETED" ? "Tenner deleted" : "Tenner already deleted", {
    tennerId,
    category: outcome.tenner.category,
    assignedTo: outcome.tenner.assignedTo,
  });
  return successResponse(200, response);
}
