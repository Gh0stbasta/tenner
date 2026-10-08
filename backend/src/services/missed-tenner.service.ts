/**
 * Missed occurrences (REC-001): a Tenner not completed on its due day disappears instead of staying overdue. The
 * notifier moves it to its next occurrence from today on and writes a SKIP history event marked `missed`, so the
 * analytics count the occurrence as not done (a deliberate skip excuses it, a miss does not).
 */

import type { SkipEvent, Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";
import { avoidVacation, isPaused, type VacationSource } from "../utils/pause.js";
import { calculateNextDue } from "../utils/schedule.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";
import type { Logger } from "../utils/logger.js";

/** Author of the notifier's writes (updatedBy, skippedBy is the assignee who missed it). */
export const SYSTEM_USER = "SYSTEM";
/** Upper bound of occurrences counted at once (a daily Tenner overdue for years). */
export const MAX_MISSED_OCCURRENCES = 1000;

/** First occurrence on or after today, following the Tenner's schedule from its missed due date. */
export function nextDueAfterMiss(
  tenner: Pick<Tenner, "nextDue" | "frequencyUnit" | "frequencyInterval" | "weekdays">,
  today: string,
): { readonly nextDue: string; readonly missedCount: number } {
  let nextDue = tenner.nextDue;
  let missedCount = 0;
  while (nextDue < today && missedCount < MAX_MISSED_OCCURRENCES) {
    nextDue = calculateNextDue(nextDue, tenner.frequencyUnit, tenner.frequencyInterval, tenner.weekdays);
    missedCount += 1;
  }
  return { nextDue, missedCount };
}

export class MissedTennerService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "list" | "skipTenner">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
    private readonly timezoneOf: TimeZoneSource,
    private readonly vacationOf: VacationSource,
    private readonly logger: Logger,
  ) {}

  /**
   * Move every active, not paused Tenner due before today. Idempotent: a moved Tenner is due today or later. A
   * Tenner changed at the same moment (completion) is left alone; the next run catches it if still due.
   * Returns the number of Tenners moved.
   */
  async moveMissed(tenantId: string): Promise<number> {
    const now = this.clock();
    const today = dateInTimeZone(now, await this.timezoneOf(tenantId));
    const vacation = await this.vacationOf(tenantId);
    const missed = (await this.tenners.list(tenantId, { active: true, nextDueBefore: today })).filter(
      (tenner) => tenner.nextDue < today && !isPaused(tenner, vacation, today),
    );
    let moved = 0;
    for (const tenner of missed) {
      const { nextDue: scheduled, missedCount } = nextDueAfterMiss(tenner, today);
      const nextDue = avoidVacation(scheduled, tenner, vacation);
      const timestamp = toUtcTimestamp(now);
      const event: SkipEvent = {
        tenantId,
        skipId: this.newId(),
        tennerId: tenner.tennerId,
        skippedBy: tenner.assignedTo,
        skippedAt: timestamp,
        skippedDue: tenner.nextDue,
        nextDue,
        reason: null,
        missed: true,
        missedCount,
      };
      try {
        await this.tenners.skipTenner({ ...tenner, nextDue, snoozedUntil: null, updatedAt: timestamp, updatedBy: SYSTEM_USER }, event, tenner);
        moved += 1;
      } catch (error) {
        this.logger.warn("Missed Tenner not moved", { event: "MissedTennerSkipped", tennerId: tenner.tennerId, error: error instanceof Error ? error.name : "UnknownError" });
      }
    }
    return moved;
  }
}
