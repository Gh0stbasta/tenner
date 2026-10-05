/** GET/POST /users, PUT /users/{userId} (HOUSEHOLD-ADMIN-001), POST /users/{userId}/deactivate|reactivate (HOUSEHOLD-ADMIN-004). */

import type { Identity } from "../auth/index.js";
import type { CreateMemberRequest, DeactivateMemberRequest, DeactivateMemberResponse, MemberResponse, UpdateMemberRequest } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { createMemberSchema, deactivateMemberSchema, parseJsonBody, updateMemberSchema, userIdSchema, validate } from "../validators/index.js";

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

export type DeactivateMember = (identity: Identity, userId: string, request: DeactivateMemberRequest) => Promise<DeactivateMemberResponse>;
export type ReactivateMember = (identity: Identity, userId: string) => Promise<MemberResponse>;

const bodyOrEmpty = (event: ApiEvent): unknown => (event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded));

export async function deactivateMemberHandler(event: ApiEvent, identity: Identity, deactivate: DeactivateMember, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const request = validate(deactivateMemberSchema, bodyOrEmpty(event));
  const result = await deactivate(identity, userId, request);
  logger.info("Household member deactivated", {
    event: "MemberDeactivated",
    userId,
    deactivatedBy: identity.userId,
    reassigned: result.reassigned,
    reassignedTo: result.reassignedTo,
    revokedAccounts: result.revokedAccounts,
  });
  return successResponse(200, result);
}

export async function reactivateMemberHandler(event: ApiEvent, identity: Identity, reactivate: ReactivateMember, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const member = await reactivate(identity, userId);
  logger.info("Household member reactivated", { event: "MemberReactivated", userId, reactivatedBy: identity.userId });
  return successResponse(200, member);
}
