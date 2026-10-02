/** API contracts for completions. */

import type { Completion, UserId } from "../models/index.js";
import type { TennerResponse } from "./tenner.dto.js";

export interface CompleteTennerRequest {
  /** Defaults to the authenticated user. Another household member is allowed (covering for someone, SECURITY-004). */
  readonly completedBy?: UserId | undefined;
  /** 1 - 1440. Defaults to the Tenner's estimatedMinutes. */
  readonly actualMinutes?: number | undefined;
  /** ISO 8601 UTC timestamp. Defaults to now. Must not be in the future. */
  readonly completedAt?: string | undefined;
}

export interface CompletionResponse {
  readonly completionId: string;
  readonly tennerId: string;
  readonly completedBy: UserId;
  readonly completedAt: string;
  readonly actualMinutes: number;
}

export interface UndoCompletionRequest {
  /** Optional; must match the authenticated user if given (SECURITY-004). */
  readonly revertedBy?: UserId | undefined;
  /** Optional, trimmed, 1 - 250 characters. */
  readonly reason?: string | undefined;
}

export interface RevertedCompletionResponse {
  readonly completionId: string;
  readonly completedBy: UserId;
  readonly completedAt: string;
  readonly actualMinutes: number;
  readonly revertedAt: string;
  readonly revertedBy: UserId;
  readonly revertReason: string | null;
}

/** POST /tenners/{tennerId}/undo-completion response (TICKET-014). */
export interface UndoCompletionResponse {
  readonly tenner: TennerResponse;
  readonly revertedCompletion: RevertedCompletionResponse;
}

export function toRevertedCompletionResponse(completion: Completion): RevertedCompletionResponse {
  return {
    completionId: completion.completionId,
    completedBy: completion.completedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
    revertedAt: completion.revertedAt ?? "",
    revertedBy: completion.revertedBy ?? completion.completedBy,
    revertReason: completion.revertReason,
  };
}

/** POST /tenners/{tennerId}/complete response (TICKET-013). */
export interface CompleteTennerResponse {
  readonly tenner: TennerResponse;
  readonly completion: CompletionResponse;
}

export function toCompletionResponse(completion: Completion): CompletionResponse {
  return {
    completionId: completion.completionId,
    tennerId: completion.tennerId,
    completedBy: completion.completedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
  };
}
