import type { UserId } from "./enums.js";

/**
 * Audit event of a skipped occurrence (SCHEDULING-004). Stored in tenner-history with eventType SKIP and
 * historyId "skip#<skipId>", without completedAt, so it never counts as a completion (see SnoozeEvent).
 * REC-001: the notifier writes the same event with `missed` for occurrences nobody completed by the end of their
 * day; unlike a skip, a missed occurrence is not excused in the analytics.
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
  /** REC-001: written by the notifier for an occurrence not completed on its day (not a deliberate skip). */
  readonly missed?: boolean;
  /** REC-001: occurrences missed at once (more than one when the notifier did not run for several cycles). */
  readonly missedCount?: number;
}
