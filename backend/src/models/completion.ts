import type { UserId } from "./enums.js";

/** One execution of a Tenner (immutable, stored in tenner-history; completionId = historyId). */
export interface Completion {
  readonly tenantId: string;
  readonly completionId: string;
  readonly tennerId: string;
  readonly completedBy: UserId;
  /** ISO 8601 UTC timestamp. */
  readonly completedAt: string;
  readonly actualMinutes: number;
  /** Set when the completion was undone (TICKET-014); null otherwise. Records are never deleted. */
  readonly revertedAt: string | null;
  readonly revertedBy: UserId | null;
  readonly revertReason: string | null;
}
