/** Completion history contracts (TICKET-020). */

import type { UserId } from "../models/index.js";

export interface HistoryRequest {
  /** YYYY-MM-DD, inclusive (UTC day). */
  readonly from?: string | undefined;
  /** YYYY-MM-DD, inclusive (UTC day). */
  readonly to?: string | undefined;
  readonly completedBy?: UserId | undefined;
  /** 1 - 100, default 20. */
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  /** Include undone (reverted) completions. Default: false. */
  readonly includeUndone?: boolean | undefined;
}

/** GET /tenners/{tennerId}/history parameters (subset of HistoryRequest). */
export type TennerHistoryRequest = Pick<HistoryRequest, "limit" | "cursor" | "includeUndone">;

export interface HistoryItemResponse {
  readonly completionId: string;
  readonly tennerId: string;
  /** Null if the Tenner record no longer exists. */
  readonly tennerTitle: string | null;
  readonly completedBy: UserId;
  readonly completedAt: string;
  readonly actualMinutes: number;
  /** Set for undone completions (only returned with includeUndone=true). */
  readonly revertedAt: string | null;
}

export interface HistoryResponse {
  readonly items: HistoryItemResponse[];
  /** Opaque cursor for the next page, or null at the end. */
  readonly nextCursor: string | null;
}
