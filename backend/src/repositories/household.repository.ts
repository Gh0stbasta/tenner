import type { AlexaSpeaker, AlexaUser, NotificationPreferencesByMember, PushSubscriptionRecord, Handover, HouseholdCategory, HouseholdMember, HouseholdSettings, HouseholdSettingsChange, UserId, Vacation } from "../models/index.js";

/** Persistence of household settings (SCHEDULING-008). Storage failures become PersistenceError. */
export interface HouseholdRepository {
  /** The household's settings, or undefined if none were saved yet. */
  get(tenantId: string): Promise<HouseholdSettings | undefined>;
  /** Create or update the given settings only (HOUSEHOLD-ADMIN-003); returns the stored settings. */
  saveSettings(tenantId: string, changes: HouseholdSettingsChange, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Create or update the vacation (null ends it); returns the stored settings (SCHEDULING-005). */
  saveVacation(tenantId: string, vacation: Vacation | null, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /**
   * Replace the member list if its version still equals `expectedVersion` (0 = never saved); stores version + 1
   * (HOUSEHOLD-ADMIN-001). Errors: ConflictError CONCURRENT_MODIFICATION, PersistenceError.
   */
  saveMembers(tenantId: string, members: readonly HouseholdMember[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Same as saveMembers for the category list (HOUSEHOLD-ADMIN-002). */
  saveCategories(tenantId: string, categories: readonly HouseholdCategory[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Same as saveMembers for the running handovers (HOUSEHOLD-004). */
  saveHandovers(tenantId: string, handovers: readonly Handover[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** Same as saveMembers for the Alexa speaker mappings (ALEXA-002). */
  /** Replace the notification preferences of all members with optimistic locking (NOTIFICATION-002). */
  saveNotificationPreferences(
    tenantId: string,
    preferences: NotificationPreferencesByMember,
    expectedVersion: number,
    actor: UserId,
    timestamp: string,
  ): Promise<HouseholdSettings>;
  /** Same as saveMembers for the Alexa accounts (ALEXA-007). */
  saveAlexaUsers(tenantId: string, users: readonly AlexaUser[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  /** NOTIFICATION-009. */
  savePushSubscriptions(tenantId: string, subscriptions: readonly PushSubscriptionRecord[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
  saveAlexaSpeakers(tenantId: string, speakers: readonly AlexaSpeaker[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings>;
}
