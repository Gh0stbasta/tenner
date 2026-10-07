import type { MemberColor, UserId } from "./enums.js";

/** A household member (HOUSEHOLD-ADMIN-001), stored in the household item of tenner-households. */
export interface HouseholdMember {
  readonly userId: UserId;
  readonly displayName: string;
  readonly color: MemberColor;
  /** Deactivation follows with HOUSEHOLD-ADMIN-004; all members are active until then. */
  readonly active: boolean;
  /**
   * HOUSEHOLD-ADMIN-006: false for members without an account (e.g. household help). They can be assigned Tenners,
   * but no Google account can claim them, so they are never a free place for strangers (TD-020).
   */
  readonly canSignIn: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Timestamp of the seed members (the household's start). */
export const SEED_TIMESTAMP = "2026-10-01T00:00:00Z";

/**
 * Seed: the members that existed before HOUSEHOLD-ADMIN-001. Used as long as a household has not stored its own
 * member list, so existing Tenners, completions and Cognito groups stay valid without a migration.
 */
export const SEED_MEMBERS: readonly HouseholdMember[] = [
  { userId: "STEFAN", displayName: "Stefan", color: "BLUE", active: true, canSignIn: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { userId: "JULIA", displayName: "Julia", color: "PURPLE", active: true, canSignIn: true, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
];
