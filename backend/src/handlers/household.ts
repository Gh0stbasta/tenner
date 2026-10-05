/** GET/PUT /household (settings, SCHEDULING-008, HOUSEHOLD-ADMIN-003) and PUT/DELETE /household/vacation (SCHEDULING-005). */

import type { Identity } from "../auth/index.js";
import type { HouseholdResponse, UpdateHouseholdRequest, VacationRequest, VacationUpdateResponse } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { parseJsonBody, updateHouseholdSchema, vacationSchema, validate } from "../validators/index.js";

export type GetHousehold = (tenantId: string) => Promise<HouseholdResponse>;
export type UpdateHousehold = (identity: Identity, request: UpdateHouseholdRequest) => Promise<HouseholdResponse>;

export async function getHouseholdHandler(tenantId: string, getHousehold: GetHousehold): Promise<ApiResult> {
  return successResponse(200, await getHousehold(tenantId));
}

export async function updateHouseholdHandler(event: ApiEvent, identity: Identity, update: UpdateHousehold, logger: Logger): Promise<ApiResult> {
  const request = validate(updateHouseholdSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const household = await update(identity, request);
  logger.info("Household settings changed", {
    event: "HouseholdSettingsChanged",
    changedFields: Object.keys(request),
    changedBy: identity.userId,
    timezone: household.timezone,
  });
  return successResponse(200, household);
}

export type SetVacation = (identity: Identity, request: VacationRequest) => Promise<VacationUpdateResponse>;
export type EndVacation = (identity: Identity) => Promise<HouseholdResponse>;

export async function setVacationHandler(event: ApiEvent, identity: Identity, setVacation: SetVacation, logger: Logger): Promise<ApiResult> {
  const request = validate(vacationSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const result = await setVacation(identity, request);
  logger.info("Household vacation set", {
    event: "HouseholdVacationSet",
    from: request.from,
    until: request.until,
    categories: request.categories ?? "ALL",
    rescheduled: result.rescheduled,
    conflicts: result.conflicts,
  });
  return successResponse(200, result);
}

export async function endVacationHandler(identity: Identity, endVacation: EndVacation, logger: Logger): Promise<ApiResult> {
  const household = await endVacation(identity);
  logger.info("Household vacation ended", { event: "HouseholdVacationEnded", endedBy: identity.userId });
  return successResponse(200, household);
}
