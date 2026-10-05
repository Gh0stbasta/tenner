/** Business logic for skipping one occurrence of a Tenner (SCHEDULING-004). */

import type { Identity } from "../auth/index.js";
import { toTennerResponse, type SkipTennerRequest, type SkipTennerResponse } from "../dto/index.js";
import { ConflictError, NotFoundError } from "../exceptions/index.js";
import type { SkipEvent, Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";
import { calculateNextDue } from "../utils/schedule.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";

export class SkipTennerService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "getById" | "skipTenner">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
    private readonly timezoneOf: TimeZoneSource,
  ) {}

  /**
   * Drop the current occurrence and schedule the next one, without a completion: lastCompleted stays,
   * snoozedUntil is cleared, and a SKIP audit event is written atomically. Inactive or archived → 409.
   */
  async skipTenner(identity: Identity, tennerId: string, request: SkipTennerRequest): Promise<SkipTennerResponse> {
    const { tenantId } = identity;
    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (!tenner.active || tenner.deletedAt !== null) throw new ConflictError("Inactive Tenners cannot be skipped.", "TENNER_INACTIVE");

    const now = this.clock();
    const today = dateInTimeZone(now, await this.timezoneOf(tenantId));
    const nextDue = nextDueAfterSkip(tenner, today);
    const timestamp = toUtcTimestamp(now);
    const event: SkipEvent = {
      tenantId,
      skipId: this.newId(),
      tennerId,
      skippedBy: identity.userId,
      skippedAt: timestamp,
      skippedDue: tenner.nextDue,
      nextDue,
      reason: request.reason ?? null,
    };
    const updated: Tenner = { ...tenner, nextDue, snoozedUntil: null, updatedAt: timestamp, updatedBy: identity.userId };
    await this.tenners.skipTenner(updated, event, tenner);

    const { skipId, skippedBy, skippedAt, skippedDue, reason } = event;
    return { tenner: toTennerResponse(updated), skip: { skipId, skippedBy, skippedAt, skippedDue, nextDue, reason } };
  }
}

/**
 * Next occurrence after a skip: one cycle from today for due and overdue Tenners; for a Tenner that is not due
 * yet, one cycle from its current due date, so a skip never moves a Tenner earlier.
 */
export function nextDueAfterSkip(tenner: Pick<Tenner, "nextDue" | "frequencyUnit" | "frequencyInterval" | "weekdays">, today: string): string {
  const base = tenner.nextDue > today ? tenner.nextDue : today;
  return calculateNextDue(base, tenner.frequencyUnit, tenner.frequencyInterval, tenner.weekdays);
}
