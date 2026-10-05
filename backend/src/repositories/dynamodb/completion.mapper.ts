/**
 * Maps tenner-history items to completion records.
 * completionId is stored as historyId; tenantTennerId ("<tenantId>#<tennerId>") is the partition key of
 * tennerId-completedAt-index (TICKET-014).
 */

import type { Completion, SkipEvent, SnoozeEvent, UserId } from "../../models/index.js";
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
    recordedBy: completion.recordedBy,
    completedAt: completion.completedAt,
    actualMinutes: completion.actualMinutes,
    revertedAt: completion.revertedAt,
    revertedBy: completion.revertedBy,
    revertReason: completion.revertReason,
    ...optional("assignedToBefore", completion.assignedToBefore),
    ...optional("originalAssigneeBefore", completion.originalAssigneeBefore),
    ...optional("previousNextDue", completion.previousNextDue),
    ...optional("idempotencyKey", record.idempotencyKey),
    ...optional("requestHash", record.requestHash),
  };
}

/** historyId prefix of snooze events. "#" never occurs in completion IDs (UUIDs), so keys cannot collide. */
export const SNOOZE_HISTORY_PREFIX = "snooze#";

/**
 * Snooze audit event (SCHEDULING-003). Deliberately without completedAt and tenantTennerId: both GSIs
 * (completedAt-index, tennerId-completedAt-index) are sparse on these keys, so completion history, undo and
 * analytics never see snoozes. Read snoozes with a base-table query on the historyId prefix if needed.
 */
export function toSnoozeItem(event: SnoozeEvent): Record<string, unknown> {
  return {
    tenantId: event.tenantId,
    historyId: `${SNOOZE_HISTORY_PREFIX}${event.snoozeId}`,
    eventType: "SNOOZE",
    tennerId: event.tennerId,
    snoozedBy: event.snoozedBy,
    snoozedAt: event.snoozedAt,
    previousNextDue: event.previousNextDue,
    snoozedUntil: event.snoozedUntil,
  };
}

/** historyId prefix of skip events (SCHEDULING-004). */
export const SKIP_HISTORY_PREFIX = "skip#";

/** Skip audit event; like snoozes without completedAt/tenantTennerId, so completion readers never see it. */
export function toSkipItem(event: SkipEvent): Record<string, unknown> {
  return {
    tenantId: event.tenantId,
    historyId: `${SKIP_HISTORY_PREFIX}${event.skipId}`,
    eventType: "SKIP",
    tennerId: event.tennerId,
    skippedBy: event.skippedBy,
    skippedAt: event.skippedAt,
    skippedDue: event.skippedDue,
    nextDue: event.nextDue,
    reason: event.reason,
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
    recordedBy: stringOrNull(item.recordedBy) as UserId | null,
    completedAt: String(item.completedAt),
    actualMinutes: Number(item.actualMinutes),
    revertedAt: stringOrNull(item.revertedAt),
    revertedBy: stringOrNull(item.revertedBy) as UserId | null,
    revertReason: stringOrNull(item.revertReason),
    ...(typeof item.assignedToBefore === "string" ? { assignedToBefore: item.assignedToBefore } : {}),
    ...(typeof item.originalAssigneeBefore === "string" ? { originalAssigneeBefore: item.originalAssigneeBefore } : {}),
    ...(typeof item.previousNextDue === "string" ? { previousNextDue: item.previousNextDue } : {}),
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
