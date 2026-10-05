/** API contracts for household self-assignment (HOTFIX-001). */

import type { UserId } from "../models/index.js";

export interface HouseholdMemberOption {
  readonly userId: UserId;
  readonly displayName: string;
  /** False once another account has claimed this member. */
  readonly available: boolean;
}

/** GET /onboarding */
export interface OnboardingResponse {
  /** The member this account is already assigned to, or null. */
  readonly assignedTo: UserId | null;
  readonly members: readonly HouseholdMemberOption[];
}

/** POST /onboarding/assignment */
export interface AssignHouseholdMemberRequest {
  readonly userId: UserId;
}

export interface AssignHouseholdMemberResponse {
  readonly userId: UserId;
}
