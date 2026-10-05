/** Business logic for postponing a Tenner (SCHEDULING-003). */

import type { Identity } from "../auth/index.js";
import { toTennerResponse, type SnoozeTennerRequest, type SnoozeTennerResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import type { SnoozeEvent, Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { addDays, toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";
import { calculateNextDue } from "../utils/schedule.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";

/** A snooze may always reach at least this many days ahead, even for short frequencies. */
export const MIN_MAX_SNOOZE_DAYS = 30;

export class SnoozeTennerService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "getById" | "snoozeTenner">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
    private readonly timezoneOf: TimeZoneSource,
  ) {}

  /**
   * Postpone a Tenner: nextDue = snoozedUntil = the requested date, plus an audit event (not a completion).
   * Rules: the date must be after today and after the current nextDue, and at most one frequency interval
   * or 30 days (whichever is later) from today. Inactive or archived Tenners → 409 TENNER_INACTIVE.
   */
  async snoozeTenner(identity: Identity, tennerId: string, request: SnoozeTennerRequest): Promise<SnoozeTennerResponse> {
    const { tenantId } = identity;
    const tenner = await this.tenners.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (!tenner.active || tenner.deletedAt !== null) throw new ConflictError("Inactive Tenners cannot be snoozed.", "TENNER_INACTIVE");

    const now = this.clock();
    const today = dateInTimeZone(now, await this.timezoneOf(tenantId));
    const until = request.until ?? addDays(today, request.days ?? 0);
    validateSnoozeDate(until, today, tenner, request.until === undefined ? "days" : "until");

    const timestamp = toUtcTimestamp(now);
    const event: SnoozeEvent = {
      tenantId,
      snoozeId: this.newId(),
      tennerId,
      snoozedBy: identity.userId,
      snoozedAt: timestamp,
      previousNextDue: tenner.nextDue,
      snoozedUntil: until,
    };
    const updated: Tenner = { ...tenner, nextDue: until, snoozedUntil: until, updatedAt: timestamp, updatedBy: identity.userId };
    await this.tenners.snoozeTenner(updated, event, tenner);

    const { snoozeId, snoozedBy, snoozedAt, previousNextDue, snoozedUntil } = event;
    return { tenner: toTennerResponse(updated), snooze: { snoozeId, snoozedBy, snoozedAt, previousNextDue, snoozedUntil } };
  }
}

/** Latest allowed snooze date: one frequency interval or 30 days from today, whichever is later. */
export function maxSnoozeDate(today: string, tenner: Pick<Tenner, "frequencyUnit" | "frequencyInterval"> & Partial<Pick<Tenner, "weekdays">>): string {
  const oneInterval = calculateNextDue(today, tenner.frequencyUnit, tenner.frequencyInterval, tenner.weekdays);
  const minimum = addDays(today, MIN_MAX_SNOOZE_DAYS);
  return oneInterval > minimum ? oneInterval : minimum;
}

function validateSnoozeDate(until: string, today: string, tenner: Tenner, field: string): void {
  const invalid = (message: string) => new ValidationError("Invalid snooze request.", [{ field, message }]);
  if (until <= today) throw invalid("Must be after today.");
  if (until <= tenner.nextDue) throw invalid(`Must be after the current due date ${tenner.nextDue}.`);
  const latest = maxSnoozeDate(today, tenner);
  if (until > latest) throw invalid(`Must not be later than ${latest} (one frequency interval or ${MIN_MAX_SNOOZE_DAYS} days).`);
}
