/** Business logic for completing a Tenner (TICKET-013). */

import type { Identity } from "../auth/index.js";
import { toCompletionResponse, toTennerResponse, type CompleteTennerRequest, type CompleteTennerResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import type { Completion, Tenner } from "../models/index.js";
import type { CompletionRecord, CompletionRepository, TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";
import { avoidVacation, type VacationSource } from "../utils/pause.js";
import { calculateNextDue, type Frequency } from "../utils/schedule.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";
import { sha256Json, uuidV5 } from "../utils/uuid.js";

/** Tolerated client clock skew for explicit completedAt values. */
export const FUTURE_TOLERANCE_MS = 60_000;

export interface CompleteTennerOutcome {
  readonly response: CompleteTennerResponse;
  /** True if an Idempotency-Key retry returned the original result. */
  readonly replayed: boolean;
}

export class CompleteTennerService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "getById" | "completeTenner">,
    private readonly completions: Pick<CompletionRepository, "getById">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
    private readonly timezoneOf: TimeZoneSource,
    private readonly vacationOf: VacationSource = async () => null,
  ) {}

  /**
   * Complete a Tenner: append an immutable history record and move the Tenner into its next cycle
   * (nextDue = completion date + frequency), atomically. With an idempotency key, retries return
   * the original result; reusing the key for a different request is a conflict.
   * completedBy defaults to the authenticated user; recordedBy is always the authenticated user (SECURITY-004).
   */
  async completeTenner(identity: Identity, tennerId: string, request: CompleteTennerRequest, idempotencyKey?: string): Promise<CompleteTennerOutcome> {
    const { tenantId } = identity;
    const completedBy = request.completedBy ?? identity.userId;
    const requestHash = sha256Json({ tennerId, completedBy, actualMinutes: request.actualMinutes ?? null, completedAt: request.completedAt ?? null });
    const completionId = idempotencyKey ? uuidV5(`${tenantId}:${idempotencyKey}`) : this.newId();

    if (idempotencyKey) {
      const existing = await this.completions.getById(tenantId, completionId);
      if (existing) return this.replay(tenantId, tennerId, existing, requestHash);
    }

    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (!tenner.active || tenner.deletedAt !== null) throw new ConflictError("Inactive Tenners cannot be completed.", "TENNER_INACTIVE");

    const now = this.clock();
    const completedAt = this.resolveCompletedAt(request.completedAt, now, tenner);
    const completion: Completion = {
      tenantId,
      completionId,
      tennerId,
      completedBy,
      recordedBy: identity.userId,
      completedAt,
      actualMinutes: request.actualMinutes ?? tenner.estimatedMinutes,
      revertedAt: null,
      revertedBy: null,
      revertReason: null,
    };
    const updated: Tenner = {
      ...tenner,
      lastCompleted: completedAt,
      // A due date inside the household vacation moves behind it (SCHEDULING-005).
      nextDue: avoidVacation(nextDueAfter(completedAt, tenner, await this.timezoneOf(tenantId)), tenner, await this.vacationOf(tenantId)),
      snoozedUntil: null,
      // Completing a paused Tenner ends its pause.
      pausedAt: null,
      pausedUntil: null,
      updatedAt: toUtcTimestamp(now),
      updatedBy: identity.userId,
    };

    try {
      await this.tenners.completeTenner(updated, { completion, idempotencyKey, requestHash }, tenner);
    } catch (error) {
      // Concurrent retry with the same idempotency key won the race: return its result.
      if (idempotencyKey && error instanceof ConflictError && error.code === "DUPLICATE_COMPLETION") {
        const existing = await this.completions.getById(tenantId, completionId);
        if (existing) return this.replay(tenantId, tennerId, existing, requestHash);
      }
      throw error;
    }

    return { response: { tenner: toTennerResponse(updated), completion: toCompletionResponse(completion) }, replayed: false };
  }

  /** Default to now; reject future timestamps and timestamps before the last completion. */
  private resolveCompletedAt(requested: string | undefined, now: Date, tenner: Tenner): string {
    if (requested === undefined) return toUtcTimestamp(now);
    const requestedTime = Date.parse(requested);
    if (requestedTime > now.getTime() + FUTURE_TOLERANCE_MS) {
      throw new ValidationError("Invalid completion request.", [{ field: "completedAt", message: "Must not be in the future." }]);
    }
    if (tenner.lastCompleted !== null && requestedTime < Date.parse(tenner.lastCompleted)) {
      throw new ValidationError("Invalid completion request.", [{ field: "completedAt", message: "Must not be earlier than the last completion." }]);
    }
    return toUtcTimestamp(new Date(requestedTime));
  }

  private async replay(tenantId: string, tennerId: string, existing: CompletionRecord, requestHash: string): Promise<CompleteTennerOutcome> {
    if (existing.completion.tennerId !== tennerId || existing.requestHash !== requestHash) {
      throw new ConflictError("The idempotency key was already used for a different request.", "IDEMPOTENCY_KEY_REUSED");
    }
    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    return { response: { tenner: toTennerResponse(tenner), completion: toCompletionResponse(existing.completion) }, replayed: true };
  }
}

/**
 * Next due date: the completion's calendar date in the household timezone (SCHEDULING-008) advanced by the
 * Tenner's frequency via calculateNextDue (SCHEDULING-001). Calendar arithmetic is DST-safe.
 */
export function nextDueAfter(completedAt: string, frequency: Frequency, timezone: string): string {
  return calculateNextDue(dateInTimeZone(new Date(completedAt), timezone), frequency.frequencyUnit, frequency.frequencyInterval, frequency.weekdays);
}
