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
  /** ISO 8601 UTC timestamp. */
  readonly createdAt: string;
  /** ISO 8601 UTC timestamp. */
  readonly updatedAt: string;
}
