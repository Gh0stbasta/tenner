/** GET/PUT /meals/profile (FOOD-004). Logs never contain allergies or other profile values. */

import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { FoodProfile } from "../models/profile.js";
import { foodProfileSchema, type FoodProfileRequest } from "../validators.js";

export type GetFoodProfile = (tenantId: string) => Promise<FoodProfile>;
export type UpdateFoodProfile = (identity: Identity, request: FoodProfileRequest) => Promise<FoodProfile>;

export async function getFoodProfileHandler(tenantId: string, getProfile: GetFoodProfile): Promise<ApiResult> {
  return successResponse(200, await getProfile(tenantId));
}

export async function updateFoodProfileHandler(event: ApiEvent, identity: Identity, updateProfile: UpdateFoodProfile, logger: Logger): Promise<ApiResult> {
  const request = validate(foodProfileSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const profile = await updateProfile(identity, request);
  logger.info("Food profile updated", { event: "FoodProfileUpdated", eaters: profile.eaters.length, updatedBy: identity.userId });
  return successResponse(200, profile);
}
