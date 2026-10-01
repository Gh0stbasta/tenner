/** Maps tenner-history items to completion records (completionId is stored as historyId). */

import type { Completion, UserId } from "../../models/index.js";
import type { CompletionRecord } from "../completion.repository.js";

export function toCompletionItem(record: CompletionRecord): Record<string, unknown> {
  const { completion } = record;
  return {
    tenantId: completion.tenantId,
    historyId: completion.completionId,
    tennerId: completion.tennerId,
    completedBy: completion.completedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
    ...(record.idempotencyKey !== undefined ? { idempotencyKey: record.idempotencyKey } : {}),
    ...(record.requestHash !== undefined ? { requestHash: record.requestHash } : {}),
  };
}

export function toCompletionRecord(item: Record<string, unknown>): CompletionRecord {
  const completion: Completion = {
    tenantId: String(item.tenantId),
    completionId: String(item.historyId),
    tennerId: String(item.tennerId),
    completedBy: item.completedBy as UserId,
    completedAt: String(item.completedAt),
    actualMinutes: Number(item.actualMinutes),
  };
  return {
    completion,
    idempotencyKey: typeof item.idempotencyKey === "string" ? item.idempotencyKey : undefined,
    requestHash: typeof item.requestHash === "string" ? item.requestHash : undefined,
  };
}
