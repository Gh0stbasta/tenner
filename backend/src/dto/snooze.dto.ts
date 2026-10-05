/** POST /tenners/{tennerId}/snooze (SCHEDULING-003). */

import type { UserId } from "../models/index.js";
import type { TennerResponse } from "./tenner.dto.js";

/** Exactly one of `until` (YYYY-MM-DD) or `days` (from today in the household timezone). */
export interface SnoozeTennerRequest {
  readonly until?: string | undefined;
  readonly days?: number | undefined;
}

export interface SnoozeResponse {
  readonly snoozeId: string;
  readonly snoozedBy: UserId;
  readonly snoozedAt: string;
  readonly previousNextDue: string;
  readonly snoozedUntil: string;
}

export interface SnoozeTennerResponse {
  readonly tenner: TennerResponse;
  readonly snooze: SnoozeResponse;
}
