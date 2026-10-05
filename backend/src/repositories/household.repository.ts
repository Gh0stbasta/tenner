import type { HouseholdCategory, HouseholdMember, HouseholdSettings, UserId, Vacation } from "../models/index.js";

/** Persistence of household settings (SCHEDULING-008). Storage failures become PersistenceError. */
export interface HouseholdRepository {
  /** The household's settings, or undefined if none were saved yet. */
  get(tenantId: string): Promise<HouseholdSettings | undefined>;
  /** Create or update the timezone; returns the stored settings. */
  saveTimezone(tenantId: string, timezone: string, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Create or update the vacation (null ends it); returns the stored settings (SCHEDULING-005). */
  saveVacation(tenantId: string, vacation: Vacation | null, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /**
   * Replace the member list if its version still equals `expectedVersion` (0 = never saved); stores version + 1
   * (HOUSEHOLD-ADMIN-001). Errors: ConflictError CONCURRENT_MODIFICATION, PersistenceError.
   */
  saveMembers(tenantId: string, members: readonly HouseholdMember[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Same as saveMembers for the category list (HOUSEHOLD-ADMIN-002). */
  saveCategories(tenantId: string, categories: readonly HouseholdCategory[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
}
