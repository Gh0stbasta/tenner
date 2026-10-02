/**
 * Maps tenner-history items to completion records.
 * completionId is stored as historyId; tenantTennerId ("<tenantId>#<tennerId>") is the partition key of
 * tennerId-completedAt-index (TICKET-014).
 */

import type { Completion, UserId } from "../../models/index.js";
import type { CompletionRecord } from "../completion.repository.js";

export function tenantTennerId(tenantId: string, tennerId: string): string {
  return `${tenantId}#${tennerId}`;
}

const optional = (key: string, value: string | undefined): Record<string, string> => (value !== undefined ? { [key]: value } : {});

export function toCompletionItem(record: CompletionRecord): Record<string, unknown> {
  const { completion } = record;
  return {
    tenantId: completion.tenantId,
    historyId: completion.completionId,
    tennerId: completion.tennerId,
    tenantTennerId: tenantTennerId(completion.tenantId, completion.tennerId),
    completedBy: completion.completedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
    revertedAt: completion.revertedAt,
    revertedBy: completion.revertedBy,
    revertReason: completion.revertReason,
    ...optional("idempotencyKey", record.idempotencyKey),
    ...optional("requestHash", record.requestHash),
  };
}

const stringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const stringOrUndefined = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export function toCompletion(item: Record<string, unknown>): Completion {
  return {
    tenantId: String(item.tenantId),
    completionId: String(item.historyId),
    tennerId: String(item.tennerId),
    completedBy: item.completedBy as UserId,
    completedAt: String(item.completedAt),
    actualMinutes: Number(item.actualMinutes),
    revertedAt: stringOrNull(item.revertedAt),
    revertedBy: stringOrNull(item.revertedBy) as UserId | null,
    revertReason: stringOrNull(item.revertReason),
  };
}

export function toCompletionRecord(item: Record<string, unknown>): CompletionRecord {
  return {
    completion: toCompletion(item),
    idempotencyKey: stringOrUndefined(item.idempotencyKey),
    requestHash: stringOrUndefined(item.requestHash),
    revertIdempotencyKey: stringOrUndefined(item.revertIdempotencyKey),
    revertRequestHash: stringOrUndefined(item.revertRequestHash),
  };
}
