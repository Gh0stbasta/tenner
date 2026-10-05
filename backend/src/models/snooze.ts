import type { UserId } from "./enums.js";

/**
 * Audit event of a postponed Tenner (SCHEDULING-003). Stored in tenner-history with eventType SNOOZE and
 * historyId "snooze#<snoozeId>". It has no completedAt, so it is not part of the completedAt GSIs and never
 * appears in completion history, undo or analytics.
 */
export interface SnoozeEvent {
  readonly tenantId: string;
  readonly snoozeId: string;
  readonly tennerId: string;
  readonly snoozedBy: UserId;
  /** ISO 8601 UTC timestamp. */
  readonly snoozedAt: string;
  /** nextDue before the snooze (YYYY-MM-DD). */
  readonly previousNextDue: string;
  /** New nextDue (YYYY-MM-DD, household-local). */
  readonly snoozedUntil: string;
}
