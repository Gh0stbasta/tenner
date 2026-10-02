/** Completion API calls (TICKET-013, TICKET-014). */

import { apiClient } from "../../api/client";
import type { UserId } from "../../types/domain";
import { completeTennerResponseSchema, type CompleteTennerResponse } from "../tenners/schemas";

export interface CompleteTennerInput {
  readonly tennerId: string;
  readonly completedBy: UserId;
  readonly actualMinutes?: number;
  /** Makes retries safe: the backend returns the original completion for the same key. */
  readonly idempotencyKey: string;
}

export function completeTenner({
  tennerId,
  completedBy,
  actualMinutes,
  idempotencyKey,
}: CompleteTennerInput): Promise<CompleteTennerResponse> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/complete`, {
    schema: completeTennerResponseSchema,
    body: { completedBy, ...(actualMinutes === undefined ? {} : { actualMinutes }) },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
