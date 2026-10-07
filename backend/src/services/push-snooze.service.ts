/** Snoozed push reminders on the household item (NOTIFICATION-011): read and remove for the notifier. */

import type { PushSnooze } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

const SYSTEM_ACTOR = "SYSTEM";

export class PushSnoozeService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "savePushSnoozes">,
    private readonly clock: Clock,
  ) {}

  async snoozesOf(tenantId: string): Promise<readonly PushSnooze[]> {
    return (await this.households.get(tenantId))?.pushSnoozes ?? [];
  }

  /** Remove the given snoozes (matched by member, Tenner and time); no write when none is stored. */
  async remove(tenantId: string, snoozes: readonly PushSnooze[]): Promise<void> {
    const settings = await this.households.get(tenantId);
    if (!settings) return;
    const matches = (stored: PushSnooze) => snoozes.some((snooze) => snooze.userId === stored.userId && snooze.tennerId === stored.tennerId && snooze.remindAt === stored.remindAt);
    if (!settings.pushSnoozes.some(matches)) return;
    await this.households.savePushSnoozes(tenantId, settings.pushSnoozes.filter((stored) => !matches(stored)), settings.pushSnoozesVersion, SYSTEM_ACTOR, toUtcTimestamp(this.clock()));
  }
}
