/** POST /tenners/{tennerId}/undo-completion: revert the latest completion (TICKET-014). */

import type { Identity } from "../auth/index.js";
import type { UndoCompletionRequest } from "../dto/index.js";
import { ApplicationError } from "../exceptions/index.js";
import type { UndoCompletionOutcome } from "../services/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { idempotencyKeySchema, parseJsonBody, tennerIdSchema, undoCompletionSchema, validate } from "../validators/index.js";

export type UndoCompletion = (identity: Identity, tennerId: string, request: UndoCompletionRequest, idempotencyKey?: string) => Promise<UndoCompletionOutcome>;

const EVENTS: Record<string, string> = {
  NO_COMPLETION_TO_UNDO: "UndoNoCompletion",
  CONCURRENT_MODIFICATION: "UndoConflict",
};

export async function undoCompletionHandler(
  event: ApiEvent,
  identity: Identity,
  undoCompletion: UndoCompletion,
  logger: Logger,
  now: () => number = Date.now,
): Promise<ApiResult> {
  const startedAt = now();
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const header = event.headers?.["idempotency-key"];
  const idempotencyKey = header === undefined ? undefined : validate(idempotencyKeySchema, header);
  const request = validate(undoCompletionSchema, parseJsonBody(event.body, event.isBase64Encoded));
  logger.info("Undo completion requested", { tennerId, revertedBy: identity.userId, idempotencyKey: idempotencyKey !== undefined });

  try {
    const { response, restoredPrevious, replayed } = await undoCompletion(identity, tennerId, request, idempotencyKey);
    logger.info("Undo completion succeeded", {
      event: "UndoSucceeded",
      tennerId,
      completionId: response.revertedCompletion.completionId,
      revertedBy: response.revertedCompletion.revertedBy,
      restoredPrevious,
      restoredNextDue: response.tenner.nextDue,
      replayed,
      durationMs: now() - startedAt,
    });
    return successResponse(200, response);
  } catch (error) {
    const code = error instanceof ApplicationError ? error.code : "INTERNAL_ERROR";
    logger.warn("Undo completion failed", { event: EVENTS[code] ?? "UndoFailed", tennerId, errorCode: code, durationMs: now() - startedAt });
    throw error;
  }
}
