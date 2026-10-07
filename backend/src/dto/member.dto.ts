/** /users contracts (HOUSEHOLD-ADMIN-001). */

import type { MemberColor, UserId } from "../models/index.js";

export interface MemberResponse {
  readonly userId: UserId;
  readonly displayName: string;
  readonly color: MemberColor;
  readonly active: boolean;
  /** HOUSEHOLD-ADMIN-006: false = member without an account (never claimable). */
  readonly canSignIn: boolean;
}

export interface CreateMemberRequest {
  /** Optional; derived from displayName when omitted. Immutable afterwards. */
  readonly userId?: UserId | undefined;
  readonly displayName: string;
  readonly color: MemberColor;
  /** Default true; false creates a member without an account (HOUSEHOLD-ADMIN-006). Immutable afterwards. */
  readonly canSignIn?: boolean | undefined;
}

export interface UpdateMemberRequest {
  readonly displayName?: string | undefined;
  readonly color?: MemberColor | undefined;
}

/** POST /users/{userId}/deactivate (HOUSEHOLD-ADMIN-004). */
export interface DeactivateMemberRequest {
  /** Required when Tenners are assigned to the member. */
  readonly reassignTo?: UserId | undefined;
}

export interface DeactivateMemberResponse {
  readonly member: MemberResponse;
  /** Number of Tenners moved to `reassignedTo`. */
  readonly reassigned: number;
  readonly reassignedTo: UserId | null;
  /** Accounts removed from the member's Cognito group. */
  readonly revokedAccounts: number;
}
