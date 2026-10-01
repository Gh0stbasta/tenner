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
}
