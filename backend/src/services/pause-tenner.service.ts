/** Pausing and resuming individual Tenners (SCHEDULING-005). */

import type { Identity } from "../auth/index.js";
import { toTennerResponse, type PauseTennerRequest, type TennerResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import type { Tenner } from "../models/index.js";
import type { ScheduleChange, TennerRepository } from "../repositories/index.js";
import { addDays, toUtcTimestamp, type Clock } from "../utils/clock.js";
import { isPausedIndividually } from "../utils/pause.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";

export class PauseTennerService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "getById" | "updateSchedule">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
  ) {}

  /**
   * Pause until a date (last paused day, after today) or until resumed. With an end date, a Tenner due on or
   * before it is moved to the day after, so it does not reappear overdue. Re-pausing replaces the pause.
   */
  async pause(identity: Identity, tennerId: string, request: PauseTennerRequest): Promise<TennerResponse> {
    const { tenner, today, now } = await this.load(identity, tennerId);
    const until = request.until ?? null;
    if (until !== null && until <= today) {
      throw new ValidationError("Invalid pause request.", [{ field: "until", message: "Must be after today." }]);
    }
    const changes: ScheduleChange = {
      pausedAt: toUtcTimestamp(now),
      pausedUntil: until,
      ...(until !== null && tenner.nextDue <= until ? { nextDue: addDays(until, 1) } : {}),
    };
    return this.save(identity, tenner, changes, now);
  }

  /** End an individual pause. A due date that passed during the pause becomes today (resume date). */
  async resume(identity: Identity, tennerId: string): Promise<TennerResponse> {
    const { tenner, today, now } = await this.load(identity, tennerId);
    if (!isPausedIndividually(tenner, today)) throw new ConflictError("The Tenner is not paused.", "TENNER_NOT_PAUSED");
    const changes: ScheduleChange = { pausedAt: null, pausedUntil: null, ...(tenner.nextDue < today ? { nextDue: today } : {}) };
    return this.save(identity, tenner, changes, now);
  }

  private async load(identity: Identity, tennerId: string): Promise<{ tenner: Tenner; today: string; now: Date }> {
    const tenner = await this.tenners.getById(identity.tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (!tenner.active || tenner.deletedAt !== null) throw new ConflictError("Inactive Tenners cannot be paused or resumed.", "TENNER_INACTIVE");
    const now = this.clock();
    return { tenner, today: dateInTimeZone(now, await this.timezoneOf(identity.tenantId)), now };
  }

  private async save(identity: Identity, tenner: Tenner, changes: ScheduleChange, now: Date): Promise<TennerResponse> {
    const updated = await this.tenners.updateSchedule(identity.tenantId, tenner.tennerId, changes, tenner.updatedAt, toUtcTimestamp(now), identity.userId);
    return toTennerResponse(updated);
  }
}
