/** POST /tenners/{tennerId}/pause and /resume (SCHEDULING-005). */

import type { Identity } from "../auth/index.js";
import type { PauseTennerRequest, TennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, pauseTennerSchema, tennerIdSchema, validate } from "../validators/index.js";

export type PauseTenner = (identity: Identity, tennerId: string, request: PauseTennerRequest) => Promise<TennerResponse>;
export type ResumeTenner = (identity: Identity, tennerId: string) => Promise<TennerResponse>;

const bodyOrEmpty = (event: ApiEvent): unknown => (event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded));

export async function pauseTennerHandler(event: ApiEvent, identity: Identity, pauseTenner: PauseTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const request = validate(pauseTennerSchema, bodyOrEmpty(event));
  const tenner = await pauseTenner(identity, tennerId, request);
  logger.info("Tenner paused", { event: "TennerPaused", tennerId, pausedBy: identity.userId, pausedUntil: tenner.pausedUntil, nextDue: tenner.nextDue });
  return successResponse(200, tenner);
}

export async function resumeTennerHandler(event: ApiEvent, identity: Identity, resumeTenner: ResumeTenner, logger: Logger): Promise<ApiResult> {
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const tenner = await resumeTenner(identity, tennerId);
  logger.info("Tenner resumed", { event: "TennerResumed", tennerId, resumedBy: identity.userId, nextDue: tenner.nextDue });
  return successResponse(200, tenner);
}
