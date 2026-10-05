/** POST /tenners/{tennerId}/skip: skip one occurrence without completing it (SCHEDULING-004). */

import type { Identity } from "../auth/index.js";
import type { SkipTennerRequest, SkipTennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, skipTennerSchema, tennerIdSchema, validate } from "../validators/index.js";

export type SkipTenner = (identity: Identity, tennerId: string, request: SkipTennerRequest) => Promise<SkipTennerResponse>;

/** An empty body is allowed (the reason is optional). The reason itself is not logged (free text). */
export async function skipTennerHandler(event: ApiEvent, identity: Identity, skipTenner: SkipTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const body = event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded);
  const request = validate(skipTennerSchema, body);
  const response = await skipTenner(identity, tennerId, request);
  logger.info("Tenner skipped", {
    event: "TennerSkipped",
    tennerId,
    skippedBy: response.skip.skippedBy,
    skippedDue: response.skip.skippedDue,
    nextDue: response.skip.nextDue,
    withReason: response.skip.reason !== null,
  });
  return successResponse(200, response);
}
