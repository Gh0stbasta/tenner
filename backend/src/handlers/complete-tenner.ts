/** POST /tenners/{tennerId}/complete: complete a Tenner (TICKET-013). */

import type { CompleteTennerRequest } from "../dto/index.js";
import { ApplicationError } from "../exceptions/index.js";
import type { CompleteTennerOutcome } from "../services/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { completeTennerSchema, idempotencyKeySchema, parseJsonBody, tennerIdSchema, validate } from "../validators/index.js";

export type CompleteTenner = (tenantId: string, tennerId: string, request: CompleteTennerRequest, idempotencyKey?: string) => Promise<CompleteTennerOutcome>;

const IDEMPOTENCY_HEADER = "idempotency-key";

export async function completeTennerHandler(
  event: ApiEvent,
  tenantId: string,
  completeTenner: CompleteTenner,
  logger: Logger,
  now: () => number = Date.now,
): Promise<ApiResult> {
  const startedAt = now();
  const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
  const header = event.headers?.[IDEMPOTENCY_HEADER];
  const idempotencyKey = header === undefined ? undefined : validate(idempotencyKeySchema, header);
  const request = validate(completeTennerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  logger.info("Tenner completion requested", { tennerId, completedBy: request.completedBy, idempotencyKey: idempotencyKey !== undefined });

  try {
    const { response, replayed } = await completeTenner(tenantId, tennerId, request, idempotencyKey);
    logger.info("Tenner completion succeeded", {
      event: "CompletionSucceeded",
      tennerId,
      completionId: response.completion.completionId,
      completedBy: response.completion.completedBy,
      actualMinutes: response.completion.actualMinutes,
      nextDue: response.tenner.nextDue,
      replayed,
      durationMs: now() - startedAt,
    });
    return successResponse(200, response);
  } catch (error) {
    const code = error instanceof ApplicationError ? error.code : "INTERNAL_ERROR";
    logger.warn("Tenner completion failed", {
      event: code === "CONCURRENT_MODIFICATION" ? "CompletionConflict" : "CompletionFailed",
      tennerId,
      errorCode: code,
      durationMs: now() - startedAt,
    });
    throw error;
  }
}
