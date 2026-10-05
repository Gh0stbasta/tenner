/** POST /tenners/{tennerId}/skip (SCHEDULING-004). */

import type { UserId } from "../models/index.js";
import type { TennerResponse } from "./tenner.dto.js";

export interface SkipTennerRequest {
  /** Optional, trimmed, 1–200 characters. */
  readonly reason?: string | undefined;
}

export interface SkipResponse {
  readonly skipId: string;
  readonly skippedBy: UserId;
  readonly skippedAt: string;
  readonly skippedDue: string;
  readonly nextDue: string;
  readonly reason: string | null;
}

export interface SkipTennerResponse {
  readonly tenner: TennerResponse;
  readonly skip: SkipResponse;
}
