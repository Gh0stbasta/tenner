import type { Category, UserId } from "./enums.js";

/** A recurring responsibility (stored in tenner-tenners). */
export interface Tenner {
  readonly tenantId: string;
  readonly tennerId: string;
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
  readonly assignedTo: UserId;
  /** ISO 8601 UTC timestamp of the last completion, or null if never completed. */
  readonly lastCompleted: string | null;
  /** Calendar date (YYYY-MM-DD) when the Tenner is due next. */
  readonly nextDue: string;
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
