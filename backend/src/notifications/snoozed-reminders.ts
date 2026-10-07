/**
 * Snoozed push reminders (NOTIFICATION-011): after „Später“ the Tenner is sent again at the stored time, if it is
 * still in the same cycle (not completed, not skipped). Outside quiet hours only; delivered or stale snoozes are
 * removed.
 */

import type { DashboardRequest, DashboardResponse, DashboardTennerResponse } from "../dto/index.js";
import type { NotificationPreferences, PushSnooze, UserId } from "../models/index.js";
import { timezoneFor } from "./daily-digest.js";
import type { NotificationItem, NotificationMessage, Recipient } from "./model.js";
import type { NotificationJob } from "./notifier.js";
import { inQuietHours } from "./schedule.js";

export interface SnoozedReminderDependencies {
  readonly snoozesOf: (tenantId: string) => Promise<readonly PushSnooze[]>;
  /** Remove the given snoozes (delivered or stale). */
  readonly removeSnoozes: (tenantId: string, snoozes: readonly PushSnooze[]) => Promise<void>;
  readonly preferencesOf: (tenantId: string, userId: UserId) => Promise<NotificationPreferences>;
  readonly dashboard: (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;
}

const dueSnoozes = (snoozes: readonly PushSnooze[], userId: UserId, now: Date) =>
  snoozes.filter((snooze) => snooze.userId === userId && Date.parse(snooze.remindAt) <= now.getTime());

function itemOf(tenner: DashboardTennerResponse): NotificationItem {
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    estimatedMinutes: tenner.estimatedMinutes,
    nextDue: tenner.nextDue,
    ...(tenner.overdueDays === undefined || tenner.overdueDays <= 0 ? {} : { overdueDays: tenner.overdueDays }),
  };
}

export function snoozedReminderJob(deps: SnoozedReminderDependencies): NotificationJob {
  // Snoozes rendered for a member in this run, removed after delivery.
  const pending = new Map<string, readonly PushSnooze[]>();
  return {
    type: "SNOOZED_REMINDER",
    async channelsDue(recipient, now) {
      if (dueSnoozes(await deps.snoozesOf(recipient.tenantId), recipient.userId, now).length === 0) return [];
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      if (inQuietHours(preferences.quietHours, now, timezoneFor(preferences, recipient))) return [];
      return ["WEB_PUSH"];
    },
    async render(recipient: Recipient, now: Date): Promise<NotificationMessage | undefined> {
      const due = dueSnoozes(await deps.snoozesOf(recipient.tenantId), recipient.userId, now);
      const dashboard = await deps.dashboard(recipient.tenantId, { assignedTo: recipient.userId });
      const open = [...dashboard.dueToday, ...dashboard.overdue];
      const still = due.filter((snooze) => open.some((tenner) => tenner.tennerId === snooze.tennerId && tenner.nextDue === snooze.nextDue));
      const stale = due.filter((snooze) => !still.includes(snooze));
      if (stale.length > 0) await deps.removeSnoozes(recipient.tenantId, stale);
      if (still.length === 0) return undefined;
      pending.set(recipient.userId, still);
      const items = still.flatMap((snooze) => open.filter((tenner) => tenner.tennerId === snooze.tennerId).slice(0, 1).map(itemOf));
      return {
        type: "SNOOZED_REMINDER",
        userId: recipient.userId,
        subject: "Erinnerung",
        textBody: items.map((item) => item.title).join(", "),
        items,
      };
    },
    dedupSuffix(message) {
      const snoozes = pending.get(message.userId) ?? [];
      return snoozes.map((snooze) => `${snooze.tennerId}@${snooze.remindAt}`).join(",");
    },
    async onDelivered(_message, recipient) {
      const delivered = pending.get(recipient.userId) ?? [];
      pending.delete(recipient.userId);
      if (delivered.length > 0) await deps.removeSnoozes(recipient.tenantId, delivered);
    },
  };
}
