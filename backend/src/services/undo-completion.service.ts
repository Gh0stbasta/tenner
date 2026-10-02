/** Business logic for undoing the latest completion of a Tenner (TICKET-014). */

import { actingUser, type Identity } from "../auth/index.js";
import {
  toRevertedCompletionResponse,
  toTennerResponse,
  type UndoCompletionRequest,
  type UndoCompletionResponse,
} from "../dto/index.js";
import { ConflictError, NotFoundError } from "../exceptions/index.js";
import type { Completion, Tenner } from "../models/index.js";
import type { CompletionRecord, CompletionRepository, TennerRepository } from "../repositories/index.js";
import { toUtcDate, toUtcTimestamp, type Clock } from "../utils/clock.js";
import { sha256Json } from "../utils/uuid.js";
import { nextDueAfter } from "./complete-tenner.service.js";

export interface UndoCompletionOutcome {
  readonly response: UndoCompletionResponse;
  /** True if a previous active completion was restored (false: first completion reverted). */
  readonly restoredPrevious: boolean;
  /** True if an Idempotency-Key retry returned the original result. */
  readonly replayed: boolean;
}

export class UndoCompletionService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "getById" | "undoCompletion">,
    private readonly completions: Pick<CompletionRepository, "getLatestActiveCompletions" | "findByRevertIdempotencyKey">,
    private readonly clock: Clock,
  ) {}

  /**
   * Revert the latest non-reverted completion and restore the schedule from the previous active completion
   * (or reset to "due on creation date" if none). Uses the Tenner's current frequencyDays. Atomic.
   * revertedBy and updatedBy are the authenticated user (SECURITY-004).
   */
  async undoLatestCompletion(identity: Identity, tennerId: string, request: UndoCompletionRequest, idempotencyKey?: string): Promise<UndoCompletionOutcome> {
    const { tenantId } = identity;
    const revertedBy = actingUser(identity, request.revertedBy, "revertedBy");
    const requestHash = sha256Json({ tennerId, revertedBy, reason: request.reason ?? null });

    if (idempotencyKey) {
      const replay = await this.findReplay(tenantId, tennerId, idempotencyKey, requestHash);
      if (replay) return replay;
    }

    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (!tenner.active || tenner.deletedAt !== null) {
      throw new ConflictError("Completions of inactive Tenners cannot be undone.", "TENNER_INACTIVE");
    }

    const [latest, previous] = await this.completions.getLatestActiveCompletions(tenantId, tennerId, 2);
    if (!latest) throw new ConflictError("No active completion is available to undo.", "NO_COMPLETION_TO_UNDO");

    const now = this.clock();
    const timestamp = toUtcTimestamp(now);
    const reverted: Completion = { ...latest, revertedAt: timestamp, revertedBy, revertReason: request.reason ?? null };
    const restored: Tenner = { ...restoreSchedule(tenner, previous, now, timestamp), updatedBy: revertedBy };

    try {
      await this.tenners.undoCompletion(restored, { completion: reverted, revertIdempotencyKey: idempotencyKey, revertRequestHash: requestHash }, tenner);
    } catch (error) {
      // A concurrent retry with the same key may have reverted the completion first.
      if (idempotencyKey && error instanceof ConflictError && error.code === "CONCURRENT_MODIFICATION") {
        const replay = await this.findReplay(tenantId, tennerId, idempotencyKey, requestHash);
        if (replay) return replay;
      }
      throw error;
    }

    return {
      response: { tenner: toTennerResponse(restored), revertedCompletion: toRevertedCompletionResponse(reverted) },
      restoredPrevious: previous !== undefined,
      replayed: false,
    };
  }

  private async findReplay(tenantId: string, tennerId: string, key: string, requestHash: string): Promise<UndoCompletionOutcome | undefined> {
    const existing: CompletionRecord | undefined = await this.completions.findByRevertIdempotencyKey(tenantId, tennerId, key);
    if (!existing) return undefined;
    if (existing.revertRequestHash !== requestHash) {
      throw new ConflictError("The idempotency key was already used for a different request.", "IDEMPOTENCY_KEY_REUSED");
    }
    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    return {
      response: { tenner: toTennerResponse(tenner), revertedCompletion: toRevertedCompletionResponse(existing.completion) },
      restoredPrevious: tenner.lastCompleted !== null,
      replayed: true,
    };
  }
}

/**
 * Restored schedule: from the previous active completion (nextDue may lie in the past = overdue again),
 * or, without one, lastCompleted = null and nextDue = createdAt date (fallback: today if createdAt is invalid).
 */
export function restoreSchedule(tenner: Tenner, previous: Completion | undefined, now: Date, timestamp: string): Tenner {
  if (previous) {
    return { ...tenner, lastCompleted: previous.completedAt, nextDue: nextDueAfter(previous.completedAt, tenner.frequencyDays), updatedAt: timestamp };
  }
  const created = new Date(tenner.createdAt);
  const nextDue = Number.isNaN(created.getTime()) ? toUtcDate(now) : toUtcDate(created);
  return { ...tenner, lastCompleted: null, nextDue, updatedAt: timestamp };
}
