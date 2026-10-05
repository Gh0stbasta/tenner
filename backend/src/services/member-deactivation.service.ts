/**
 * Member deactivation (HOUSEHOLD-ADMIN-004): open Tenners are reassigned, the member is kept (history keeps the
 * name) but can no longer be assigned or complete Tenners, and accounts lose access to the member's group.
 */

import type { Identity } from "../auth/index.js";
import type { DeactivateMemberRequest, DeactivateMemberResponse, MemberResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { SEED_MEMBERS, type HouseholdMember, type UserId } from "../models/index.js";
import type { HouseholdRepository, TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";
import { toMemberResponse } from "./member.service.js";

/** Removes all accounts from a member's household group; returns the number removed (0 without Cognito). */
export type RevokeMemberAccess = (tenantId: string, userId: UserId) => Promise<number>;

export class MemberDeactivationService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "saveMembers">,
    private readonly tenners: Pick<TennerRepository, "list" | "update">,
    private readonly revokeAccess: RevokeMemberAccess,
    private readonly clock: Clock,
  ) {}

  /**
   * Rules: not yourself (409 CANNOT_DEACTIVATE_SELF), not the last active member (409 LAST_ACTIVE_MEMBER), not twice
   * (409 MEMBER_INACTIVE). Non-archived Tenners of the member need `reassignTo` (another active member).
   * Order: reassign, then deactivate, then revoke access — a failure leaves the member active, and a retry finishes.
   */
  async deactivate(identity: Identity, userId: UserId, request: DeactivateMemberRequest): Promise<DeactivateMemberResponse> {
    const { tenantId } = identity;
    const { members, version } = await this.load(tenantId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) throw new NotFoundError("Household member not found.");
    if (!member.active) throw new ConflictError("The member is already deactivated.", "MEMBER_INACTIVE");
    if (userId === identity.userId) throw new ConflictError("You cannot deactivate yourself.", "CANNOT_DEACTIVATE_SELF");
    if (members.filter((candidate) => candidate.active).length <= 1) throw new ConflictError("The last active member cannot be deactivated.", "LAST_ACTIVE_MEMBER");

    const assigned = await this.tenners.list(tenantId, { assignedTo: userId });
    const reassignTo = request.reassignTo;
    if (assigned.length > 0 && reassignTo === undefined) {
      throw new ValidationError("Invalid deactivation.", [{ field: "reassignTo", message: `Required: ${assigned.length} Tenner(s) are assigned to ${userId}.` }]);
    }
    if (reassignTo !== undefined && (reassignTo === userId || !members.some((candidate) => candidate.userId === reassignTo && candidate.active))) {
      throw new ValidationError("Invalid deactivation.", [{ field: "reassignTo", message: "Must be another active household member." }]);
    }

    const timestamp = toUtcTimestamp(this.clock());
    for (const tenner of assigned) {
      await this.tenners.update(tenantId, tenner.tennerId, { assignedTo: reassignTo, updatedAt: timestamp, updatedBy: identity.userId });
    }
    const deactivated: HouseholdMember = { ...member, active: false, updatedAt: timestamp };
    await this.households.saveMembers(tenantId, members.map((candidate) => (candidate.userId === userId ? deactivated : candidate)), version, identity.userId, timestamp);
    const revokedAccounts = await this.revokeAccess(tenantId, userId);
    return { member: toMemberResponse(deactivated), reassigned: assigned.length, reassignedTo: assigned.length > 0 ? (reassignTo ?? null) : null, revokedAccounts };
  }

  /** Make a member assignable again. Its person regains access by picking the member on the next login (onboarding). */
  async reactivate(identity: Identity, userId: UserId): Promise<MemberResponse> {
    const { members, version } = await this.load(identity.tenantId);
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) throw new NotFoundError("Household member not found.");
    if (member.active) throw new ConflictError("The member is already active.", "MEMBER_ACTIVE");
    const timestamp = toUtcTimestamp(this.clock());
    const reactivated: HouseholdMember = { ...member, active: true, updatedAt: timestamp };
    await this.households.saveMembers(identity.tenantId, members.map((candidate) => (candidate.userId === userId ? reactivated : candidate)), version, identity.userId, timestamp);
    return toMemberResponse(reactivated);
  }

  private async load(tenantId: string): Promise<{ members: readonly HouseholdMember[]; version: number }> {
    const settings = await this.households.get(tenantId);
    return { members: settings?.members ?? SEED_MEMBERS, version: settings?.membersVersion ?? 0 };
  }
}
