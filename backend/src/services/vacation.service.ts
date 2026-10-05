/** Household vacation mode (SCHEDULING-005). */

import type { Identity } from "../auth/index.js";
import type { HouseholdResponse, VacationRequest, VacationUpdateResponse } from "../dto/index.js";
import { ConflictError, ValidationError } from "../exceptions/index.js";
import type { Vacation } from "../models/index.js";
import type { HouseholdRepository, TennerRepository } from "../repositories/index.js";
import { addDays, toUtcTimestamp, type Clock } from "../utils/clock.js";
import { affectedByVacation, averageDailyLoad, distributeResume, RESUME_LOAD_FACTOR } from "../utils/pause.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";
import type { Logger } from "../utils/logger.js";
import { toHouseholdResponse } from "./household.service.js";

export class VacationService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "saveVacation">,
    private readonly tenners: Pick<TennerRepository, "list" | "updateSchedule">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
    private readonly logger: Logger,
  ) {}

  /**
   * Save the vacation and move affected Tenners (due within it, or already overdue once it has started) behind it,
   * spread so that no day exceeds the average daily load + 50 %. Tenners changed concurrently keep their date.
   */
  async setVacation(identity: Identity, request: VacationRequest): Promise<VacationUpdateResponse> {
    const { tenantId } = identity;
    const timezone = await this.timezoneOf(tenantId);
    const now = this.clock();
    const today = dateInTimeZone(now, timezone);
    if (request.until < today) throw new ValidationError("Invalid vacation.", [{ field: "until", message: "Must not be in the past." }]);
    const vacation: Vacation = { from: request.from, until: request.until, categories: request.categories ?? null };

    const timestamp = toUtcTimestamp(now);
    const saved = await this.households.saveVacation(tenantId, vacation, identity.userId, timestamp);
    const active = (await this.tenners.list(tenantId, { active: true })).filter((t) => t.active && t.deletedAt === null);
    const moved = active.filter((t) => affectedByVacation(t, vacation, today));
    const movedIds = new Set(moved.map((t) => t.tennerId));
    const existing = active.filter((t) => !movedIds.has(t.tennerId) && t.nextDue > vacation.until);
    const assignments = distributeResume(moved, existing, addDays(vacation.until, 1), averageDailyLoad(active) * RESUME_LOAD_FACTOR);

    let conflicts = 0;
    for (const tenner of moved) {
      const nextDue = assignments.get(tenner.tennerId) ?? addDays(vacation.until, 1);
      try {
        await this.tenners.updateSchedule(tenantId, tenner.tennerId, { nextDue }, tenner.updatedAt, timestamp, identity.userId);
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        conflicts += 1;
        this.logger.warn("Vacation reschedule skipped", { tennerId: tenner.tennerId, errorCode: error.code });
      }
    }
    return { household: toHouseholdResponse(saved, timezone), rescheduled: moved.length - conflicts, conflicts };
  }

  /** End the vacation. Moved due dates stay as they are (no Tenner becomes due earlier than planned). */
  async endVacation(identity: Identity): Promise<HouseholdResponse> {
    const timezone = await this.timezoneOf(identity.tenantId);
    const saved = await this.households.saveVacation(identity.tenantId, null, identity.userId, toUtcTimestamp(this.clock()));
    return toHouseholdResponse(saved, timezone);
  }
}
