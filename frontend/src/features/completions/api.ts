/** Completion API calls (TICKET-013, TICKET-014, TICKET-020). */

import { z } from "zod";
import { apiClient } from "../../api/client";
import type { UserId } from "../../types/domain";
import {
  completeTennerResponseSchema,
  tennerSchema,
  userIdSchema,
  type CompleteTennerResponse,
} from "../tenners/schemas";

export interface CompleteTennerInput {
  readonly tennerId: string;
  readonly completedBy: UserId;
  readonly actualMinutes?: number;
  /** Makes retries safe: the backend returns the original completion for the same key. */
  readonly idempotencyKey: string;
  /** When it was done (UTC); default: now on the server. Offline replays send the device time (MOBILE-004). */
  readonly completedAt?: string;
}

export function completeTenner({
  tennerId,
  completedBy,
  actualMinutes,
  idempotencyKey,
  completedAt,
}: CompleteTennerInput): Promise<CompleteTennerResponse> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/complete`, {
    schema: completeTennerResponseSchema,
    body: {
      completedBy,
      ...(actualMinutes === undefined ? {} : { actualMinutes }),
      ...(completedAt === undefined ? {} : { completedAt }),
    },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

const undoResponseSchema = z.object({
  tenner: tennerSchema,
  revertedCompletion: z.object({ completionId: z.string(), revertedAt: z.string(), revertedBy: userIdSchema }),
});
export type UndoCompletionResponse = z.infer<typeof undoResponseSchema>;

export interface UndoCompletionInput {
  readonly tennerId: string;
  readonly revertedBy: UserId;
  readonly idempotencyKey: string;
}

/** Reverts the Tenner's latest completion (TICKET-014). */
export function undoCompletion({
  tennerId,
  revertedBy,
  idempotencyKey,
}: UndoCompletionInput): Promise<UndoCompletionResponse> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/undo-completion`, {
    schema: undoResponseSchema,
    body: { revertedBy },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export const historyItemSchema = z.object({
  completionId: z.string(),
  tennerId: z.string(),
  tennerTitle: z.string().nullable(),
  completedBy: userIdSchema,
  completedAt: z.string(),
  actualMinutes: z.number(),
  revertedAt: z.string().nullable(),
});
export type HistoryItem = z.infer<typeof historyItemSchema>;

export const historyPageSchema = z.object({ items: z.array(historyItemSchema), nextCursor: z.string().nullable() });
export type HistoryPage = z.infer<typeof historyPageSchema>;

export const RECENT_ACTIVITY_LIMIT = 10;

/** Latest completions of the household, newest first (GET /history). */
export function fetchRecentActivity(): Promise<HistoryPage> {
  return apiClient.get("/history", { schema: historyPageSchema, query: { limit: RECENT_ACTIVITY_LIMIT } });
}
