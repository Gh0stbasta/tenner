/** GET /onboarding and POST /onboarding/assignment: household self-assignment (HOTFIX-001). */

import type { Principal } from "../auth/index.js";
import type { OnboardingResponse } from "../dto/index.js";
import type { UserId } from "../models/index.js";
import type { AssignmentOutcome } from "../services/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { assignHouseholdMemberSchema, parseJsonBody, validate } from "../validators/index.js";

export type GetOnboarding = (principal: Principal) => Promise<OnboardingResponse>;
export type AssignHouseholdMember = (principal: Principal, userId: UserId) => Promise<AssignmentOutcome>;

export async function onboardingHandler(principal: Principal, getOnboarding: GetOnboarding): Promise<ApiResult> {
  return successResponse(200, await getOnboarding(principal));
}

export async function assignHouseholdMemberHandler(event: ApiEvent, principal: Principal, assign: AssignHouseholdMember, logger: Logger): Promise<ApiResult> {
  const request = validate(assignHouseholdMemberSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const { response, group } = await assign(principal, request.userId);
  // Audit trail: Cognito username (google_<subject>), never the e-mail address.
  logger.info("Household member assigned", { event: "HouseholdMemberAssigned", username: principal.username, userId: response.userId, group });
  return successResponse(201, response);
}
