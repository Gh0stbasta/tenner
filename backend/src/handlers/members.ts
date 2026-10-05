/** GET/POST /users and PUT /users/{userId}: household members (HOUSEHOLD-ADMIN-001). */

import type { Identity } from "../auth/index.js";
import type { CreateMemberRequest, MemberResponse, UpdateMemberRequest } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { createMemberSchema, parseJsonBody, updateMemberSchema, userIdSchema, validate } from "../validators/index.js";

export type ListMembers = (tenantId: string) => Promise<MemberResponse[]>;
export type CreateMember = (identity: Identity, request: CreateMemberRequest) => Promise<MemberResponse>;
export type UpdateMember = (identity: Identity, userId: string, request: UpdateMemberRequest) => Promise<MemberResponse>;

export async function listMembersHandler(tenantId: string, listMembers: ListMembers): Promise<ApiResult> {
  return successResponse(200, await listMembers(tenantId));
}

export async function createMemberHandler(event: ApiEvent, identity: Identity, createMember: CreateMember, logger: Logger): Promise<ApiResult> {
  const request = validate(createMemberSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const member = await createMember(identity, request);
  logger.info("Household member created", { event: "MemberCreated", userId: member.userId, createdBy: identity.userId });
  return successResponse(201, member);
}

export async function updateMemberHandler(event: ApiEvent, identity: Identity, updateMember: UpdateMember, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const request = validate(updateMemberSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const member = await updateMember(identity, userId, request);
  logger.info("Household member updated", { event: "MemberUpdated", userId, changedFields: Object.keys(request), updatedBy: identity.userId });
  return successResponse(200, member);
}
