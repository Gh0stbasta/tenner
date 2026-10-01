/** API contracts for completions. */

import type { Completion, UserId } from "../models/index.js";

export interface CompleteTennerRequest {
  readonly completedBy: UserId;
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

export function toCompletionResponse(completion: Completion): CompletionResponse {
  return {
    completionId: completion.completionId,
    tennerId: completion.tennerId,
    completedBy: completion.completedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
  };
}
