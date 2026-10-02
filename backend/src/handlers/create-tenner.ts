/** POST /tenners: create a Tenner (TICKET-009). */

import type { Identity } from "../auth/index.js";
import type { CreateTennerRequest, TennerResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { createTennerSchema, parseJsonBody, validate } from "../validators/index.js";

export type CreateTenner = (identity: Identity, request: CreateTennerRequest) => Promise<TennerResponse>;

export async function createTennerHandler(event: ApiEvent, identity: Identity, createTenner: CreateTenner, logger: Logger): Promise<ApiResult> {
  const request = validate(createTennerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const tenner = await createTenner(identity, request);
  logger.info("Tenner created", { tennerId: tenner.tennerId, createdBy: tenner.createdBy, assignedTo: tenner.assignedTo, category: tenner.category });
  return successResponse(201, tenner);
}
