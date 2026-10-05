import type { HouseholdSettings, UserId } from "../models/index.js";

/** Persistence of household settings (SCHEDULING-008). Storage failures become PersistenceError. */
export interface HouseholdRepository {
  /** The household's settings, or undefined if none were saved yet. */
  get(tenantId: string): Promise<HouseholdSettings | undefined>;
  /** Create or update the timezone; returns the stored settings. */
  saveTimezone(tenantId: string, timezone: string, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
}
