/**
 * Household membership store (HOTFIX-001): Cognito groups "household:<tenantId>:<userId>".
 * Implementations translate storage failures into PersistenceError.
 */
export interface HouseholdMembershipRepository {
  /** Names of all groups the user belongs to (live, not from the token). */
  groupsOf(username: string): Promise<string[]>;
  /** Number of users in the group, capped at 2 (enough to tell "free", "taken" and "conflict"). */
  memberCount(group: string): Promise<number>;
  /** Create the group if it does not exist yet (members added in the app, HOUSEHOLD-ADMIN-001). Idempotent. */
  ensureGroup(group: string): Promise<void>;
  addMember(username: string, group: string): Promise<void>;
  removeMember(username: string, group: string): Promise<void>;
}
