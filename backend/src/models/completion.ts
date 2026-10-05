import type { UserId } from "./enums.js";

export type ActualMinutesSource = "USER" | "DEFAULT";

/** One execution of a Tenner (immutable, stored in tenner-history; completionId = historyId). */
export interface Completion {
  readonly tenantId: string;
  readonly completionId: string;
  readonly tennerId: string;
  readonly completedBy: UserId;
  /**
   * Authenticated user who recorded the completion (SECURITY-004). Differs from completedBy when someone
   * records a completion for another household member. Null for records created before authentication.
   */
  readonly recordedBy: UserId | null;
  /** ISO 8601 UTC timestamp. */
  readonly completedAt: string;
  readonly actualMinutes: number;
  /** Set when the completion was undone (TICKET-014); null otherwise. Records are never deleted. */
  readonly revertedAt: string | null;
  readonly revertedBy: UserId | null;
  readonly revertReason: string | null;
  /** Assignee before this completion advanced a rotation (HOUSEHOLD-001); undo restores it. */
  readonly assignedToBefore?: UserId | undefined;
  /** Handover state before the completion (HOUSEHOLD-004), set only with assignedToBefore when not null. */
  readonly originalAssigneeBefore?: UserId | undefined;
  /**
   * Due date (household-local YYYY-MM-DD) the Tenner had when it was completed (ANALYTICS-001), for the on-time
   * rate. Records written before have none.
   */
  readonly previousNextDue?: string | undefined;
  /**
   * Where actualMinutes came from (ANALYTICS-005): USER = sent with the request, DEFAULT = the estimate. Records
   * written before have none and count as DEFAULT.
   */
  readonly actualMinutesSource?: ActualMinutesSource | undefined;
}
