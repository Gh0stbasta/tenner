/**
 * Household self-assignment (HOTFIX-001, ADR 0002 amendment).
 *
 * A signed-in Google user without a household group picks a household member. Each member can be claimed by
 * exactly one account, and each account can claim only one member. Once all members are taken, strangers
 * cannot get in. Membership is the Cognito group "household:<tenantId>:<userId>", which the backend already
 * reads from the ID token (identityFromEvent), so no other authorization changes.
 */

import { householdGroupName, HOUSEHOLD_GROUP_PREFIX, type Principal } from "../auth/index.js";
import type { AssignHouseholdMemberResponse, OnboardingResponse } from "../dto/index.js";
import { ConflictError, NotFoundError } from "../exceptions/index.js";
import type { UserId } from "../models/index.js";
import type { HouseholdMembershipRepository } from "../repositories/index.js";
import type { MemberSource } from "./member.service.js";

export interface AssignmentOutcome {
  readonly response: AssignHouseholdMemberResponse;
  /** The Cognito group the account was added to (for logging). */
  readonly group: string;
}

export class HouseholdAssignmentService {
  constructor(
    private readonly memberships: HouseholdMembershipRepository,
    private readonly tenantId: string,
    /** Managed household members (HOUSEHOLD-ADMIN-001). */
    private readonly membersOf: MemberSource,
  ) {}

  /** The account's current member (live from Cognito) and which members are still free. */
  async getOnboarding(principal: Principal): Promise<OnboardingResponse> {
    const groups = await this.memberships.groupsOf(principal.username);
    const users = await this.membersOf(this.tenantId);
    const members = await Promise.all(
      users.filter((user) => user.active).map(async (user) => ({
        userId: user.userId,
        displayName: user.displayName,
        available: (await this.memberships.memberCount(this.groupOf(user.userId))) === 0,
      })),
    );
    return { assignedTo: this.assignedMember(groups, users), members };
  }

  /**
   * Claim a household member for this account.
   * 409 ALREADY_ASSIGNED if the account already has a member, 409 MEMBER_TAKEN if another account has it.
   * Concurrent claims of the same member: after adding, the group is counted again; with more than one member
   * this account withdraws, so a member never stays assigned to two accounts.
   */
  async assign(principal: Principal, userId: UserId): Promise<AssignmentOutcome> {
    if (!(await this.membersOf(this.tenantId)).some((user) => user.userId === userId && user.active)) {
      throw new NotFoundError("Household member not found.");
    }
    const groups = await this.memberships.groupsOf(principal.username);
    if (groups.some((group) => group.startsWith(HOUSEHOLD_GROUP_PREFIX))) {
      throw new ConflictError("This account is already assigned to a household member.", "ALREADY_ASSIGNED");
    }
    const group = this.groupOf(userId);
    if ((await this.memberships.memberCount(group)) > 0) throw memberTaken();

    await this.memberships.ensureGroup(group);
    await this.memberships.addMember(principal.username, group);
    if ((await this.memberships.memberCount(group)) > 1) {
      await this.memberships.removeMember(principal.username, group);
      throw memberTaken();
    }
    return { response: { userId }, group };
  }

  private groupOf(userId: UserId): string {
    return householdGroupName(this.tenantId, userId);
  }

  private assignedMember(groups: readonly string[], users: readonly { readonly userId: UserId }[]): UserId | null {
    const member = users.find((user) => groups.includes(this.groupOf(user.userId)));
    return member?.userId ?? null;
  }
}

function memberTaken(): ConflictError {
  return new ConflictError("This household member is already taken.", "MEMBER_TAKEN");
}
