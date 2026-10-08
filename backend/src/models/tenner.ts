import type { AssignmentMode, Category, FrequencyUnit, UserId, Weekday } from "./enums.js";

/** A recurring responsibility (stored in tenner-tenners). */
export interface Tenner {
  readonly tenantId: string;
  readonly tennerId: string;
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  /**
   * Days between due dates. Exact for DAY/WEEK; for MONTH/YEAR an approximation (30/365 per unit) used only for
   * analytics ratios, never for due dates (SCHEDULING-001).
   */
  readonly frequencyDays: number;
  /** Unit of the recurrence (SCHEDULING-001). Items stored before have none and are read as DAY. */
  readonly frequencyUnit: FrequencyUnit;
  /** Number of units between due dates (≥ 1). Items stored before have none and are read as frequencyDays. */
  readonly frequencyInterval: number;
  /**
   * Weekdays the Tenner is due on (SCHEDULING-002), ISO order, only with frequencyUnit WEEK; null otherwise.
   * Items stored before have none and are read as null.
   */
  readonly weekdays: readonly Weekday[] | null;
  readonly assignedTo: UserId;
  /** HOUSEHOLD-001; items stored before read as FIXED. */
  readonly assignmentMode: AssignmentMode;
  /** Ordered members for ROTATING (at least 2); null for FIXED. */
  readonly rotation: readonly UserId[] | null;
  /**
   * Member the Tenner belongs to while it is handed over to `assignedTo` (HOUSEHOLD-004), or null. The handover's
   * end gives it back; a manual reassignment clears it. Items stored before read as null.
   */
  readonly originalAssignee: UserId | null;
  /** ISO 8601 UTC timestamp of the last completion, or null if never completed. */
  readonly lastCompleted: string | null;
  /** Calendar date (YYYY-MM-DD) when the Tenner is due next. */
  readonly nextDue: string;
  /**
   * HOTFIX-006: first day the Tenner is active (YYYY-MM-DD, household-local); it is due on that day at the earliest.
   * Absent on Tenners created before HOTFIX-006: their start is the creation date (see startDateOf).
   */
  readonly startDate?: string | undefined;
  /** Date the Tenner was postponed to (SCHEDULING-003), or null. Cleared by the next completion. */
  readonly snoozedUntil: string | null;
  /** Start of an individual pause (UTC timestamp, SCHEDULING-005), or null. */
  readonly pausedAt: string | null;
  /** Last paused day (YYYY-MM-DD) or null for an open-ended pause. Only meaningful with pausedAt. */
  readonly pausedUntil: string | null;
  readonly active: boolean;
  /** ISO 8601 UTC timestamp of the soft delete, or null if not deleted (TICKET-012). */
  readonly deletedAt: string | null;
  /** ISO 8601 UTC timestamp. */
  readonly createdAt: string;
  /** ISO 8601 UTC timestamp. */
  readonly updatedAt: string;
  /** Authenticated user who created the Tenner (SECURITY-004); null for records created before authentication. */
  readonly createdBy: UserId | null;
  /** Authenticated user of the last write (SECURITY-004); null for records last written before authentication. */
  readonly updatedBy: UserId | null;
}

/** HOTFIX-006: the start date; Tenners created before it start on their creation date (UTC date of createdAt). */
export const startDateOf = (tenner: Pick<Tenner, "startDate" | "createdAt">): string => tenner.startDate ?? tenner.createdAt.slice(0, 10);
