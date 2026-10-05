/** POST /tenners/{tennerId}/snooze: postpone a Tenner without completing it (SCHEDULING-003). */

import type { Identity } from "../auth/index.js";
import type { SnoozeTennerRequest, SnoozeTennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, snoozeTennerSchema, tennerIdSchema, validate } from "../validators/index.js";

export type SnoozeTenner = (identity: Identity, tennerId: string, request: SnoozeTennerRequest) => Promise<SnoozeTennerResponse>;

export async function snoozeTennerHandler(event: ApiEvent, identity: Identity, snoozeTenner: SnoozeTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const request = validate(snoozeTennerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const response = await snoozeTenner(identity, tennerId, request);
  logger.info("Tenner snoozed", {
    event: "TennerSnoozed",
    tennerId,
    snoozedBy: response.snooze.snoozedBy,
    previousNextDue: response.snooze.previousNextDue,
    snoozedUntil: response.snooze.snoozedUntil,
  });
  return successResponse(200, response);
}
