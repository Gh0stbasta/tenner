/** GET /household and PUT /household: household timezone (SCHEDULING-008). */

import type { Identity } from "../auth/index.js";
import type { HouseholdResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, updateHouseholdSchema, validate } from "../validators/index.js";

export type GetHousehold = (tenantId: string) => Promise<HouseholdResponse>;
export type UpdateHouseholdTimezone = (identity: Identity, timezone: string) => Promise<HouseholdResponse>;

export async function getHouseholdHandler(tenantId: string, getHousehold: GetHousehold): Promise<ApiResult> {
  return successResponse(200, await getHousehold(tenantId));
}

export async function updateHouseholdHandler(event: ApiEvent, identity: Identity, update: UpdateHouseholdTimezone, logger: Logger): Promise<ApiResult> {
  const request = validate(updateHouseholdSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const household = await update(identity, request.timezone);
  logger.info("Household timezone changed", { event: "HouseholdTimezoneChanged", timezone: household.timezone });
  return successResponse(200, household);
}
