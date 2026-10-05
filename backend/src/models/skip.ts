import type { UserId } from "./enums.js";

/**
 * Audit event of a skipped occurrence (SCHEDULING-004). Stored in tenner-history with eventType SKIP and
 * historyId "skip#<skipId>", without completedAt, so it never counts as a completion (see SnoozeEvent).
 */
export interface SkipEvent {
  readonly tenantId: string;
  readonly skipId: string;
  readonly tennerId: string;
  readonly skippedBy: UserId;
  /** ISO 8601 UTC timestamp. */
  readonly skippedAt: string;
  /** Due date of the skipped occurrence (YYYY-MM-DD). */
  readonly skippedDue: string;
  /** New nextDue (YYYY-MM-DD, household-local). */
  readonly nextDue: string;
  readonly reason: string | null;
}
