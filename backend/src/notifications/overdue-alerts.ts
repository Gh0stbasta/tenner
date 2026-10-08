/**
 * Overdue alerts (NOTIFICATION-004): a Tenner of the member (own or shared) that is at least `minDaysOverdue` days
 * overdue is alerted once per overdue cycle (cycle = the Tenner's nextDue; completing or snoozing starts a new one),
 * plus one reminder after 2 × frequencyDays overdue. All due Tenners of a member are bundled into one message per
 * day, sent at the member's evening time (default 18:00, NOTIFICATION-010) outside quiet hours.
 */

import type { DashboardRequest, DashboardResponse, DashboardTennerResponse } from "../dto/index.js";
import type { NotificationPreferences, UserId } from "../models/index.js";
import { deliveryRecord, type DeliveryLog } from "./delivery.js";
import { timezoneFor, withLog } from "./daily-digest.js";
import type { NotificationMessage, Recipient } from "./model.js";
import type { NotificationJob } from "./notifier.js";
import { inQuietHours, isDueAt } from "./schedule.js";
import { bulletList, daysText, tenners } from "./text.js";

export const ALERT_ITEM_LIMIT = 10;

export interface OverdueAlertDependencies {
  readonly preferencesOf: (tenantId: string, userId: UserId) => Promise<NotificationPreferences>;
  readonly dashboard: (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;
  /** frequencyDays per Tenner ID (for the escalation threshold). */
  readonly frequencies: (tenantId: string) => Promise<ReadonlyMap<string, number>>;
  readonly log: Pick<DeliveryLog, "has" | "mark">;
  readonly appUrl: string | undefined;
}

/** Marker key of one Tenner's overdue cycle (ticket format), optionally for the escalation reminder. */
export function cycleKey(recipient: Recipient, tenner: Pick<DashboardTennerResponse, "tennerId" | "nextDue">, escalation = false): string {
  return [recipient.tenantId, recipient.userId, "OVERDUE", tenner.tennerId, tenner.nextDue, ...(escalation ? ["ESCALATION"] : [])].join("#");
}

export interface AlertItem {
  readonly tenner: DashboardTennerResponse;
  readonly escalation: boolean;
}

/** Tenners to alert now: first alert of the cycle, or the one escalation reminder. */
export async function alertItems(deps: OverdueAlertDependencies, recipient: Recipient, dashboard: DashboardResponse, minDaysOverdue: number): Promise<AlertItem[]> {
  const frequencies = await deps.frequencies(recipient.tenantId);
  const items: AlertItem[] = [];
  for (const tenner of dashboard.overdue) {
    const days = tenner.overdueDays ?? 0;
    if (days < Math.max(minDaysOverdue, 1)) continue;
    if (!(await deps.log.has(cycleKey(recipient, tenner)))) {
      items.push({ tenner, escalation: false });
      continue;
    }
    const frequency = frequencies.get(tenner.tennerId);
    if (frequency !== undefined && days >= 2 * frequency && !(await deps.log.has(cycleKey(recipient, tenner, true)))) items.push({ tenner, escalation: true });
  }
  return items;
}

export function renderAlert(items: readonly AlertItem[], recipient: Recipient, appUrl: string | undefined): NotificationMessage {
  const lines = [
    `${recipient.displayName}, ${items.length === 1 ? "eine Aufgabe ist" : `${items.length} Aufgaben sind`} überfällig:`,
    ...bulletList(
      items.map((item) => `${item.tenner.title} — ${daysText(item.tenner.overdueDays ?? 1)}${item.escalation ? " (Erinnerung)" : ""}`),
      ALERT_ITEM_LIMIT,
    ),
    ...(appUrl === undefined ? [] : ["", `Zentrale öffnen → ${appUrl}`]),
  ];
  return {
    type: "OVERDUE_ALERT",
    userId: recipient.userId,
    subject: `Überfällig: ${tenners(items.length)}`,
    textBody: lines.join("\n"),
    ...(appUrl === undefined ? {} : { deepLink: appUrl }),
    facts: { overdue: items.length, oldestDays: Math.max(...items.map((item) => item.tenner.overdueDays ?? 0)) },
    items: items.map(({ tenner }) => ({
      tennerId: tenner.tennerId,
      title: tenner.title,
      estimatedMinutes: tenner.estimatedMinutes,
      overdueDays: tenner.overdueDays ?? 1,
      nextDue: tenner.nextDue,
    })),
  };
}

export function overdueAlertJob(deps: OverdueAlertDependencies): NotificationJob {
  // Items rendered for a member in this run, remembered after delivery.
  const pending = new Map<string, AlertItem[]>();
  return {
    type: "OVERDUE_ALERT",
    async channelsDue(recipient, now) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const timezone = timezoneFor(preferences, recipient);
      if (!preferences.overdueAlerts.enabled || !isDueAt(preferences.overdueAlerts.time, now, timezone) || inQuietHours(preferences.quietHours, now, timezone)) return [];
      return withLog(preferences.overdueAlerts.channels);
    },
    async render(recipient) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const dashboard = await deps.dashboard(recipient.tenantId, { assignedTo: recipient.userId });
      const items = await alertItems(deps, recipient, dashboard, preferences.overdueAlerts.minDaysOverdue);
      if (items.length === 0) return undefined;
      pending.set(recipient.userId, items);
      return renderAlert(items, recipient, deps.appUrl);
    },
    async onDelivered(_message, recipient, now) {
      for (const item of pending.get(recipient.userId) ?? []) {
        await deps.log.mark(deliveryRecord(cycleKey(recipient, item.tenner, item.escalation), { type: "OVERDUE_ALERT", channel: "ANY", userId: recipient.userId }, now, "SENT"));
      }
      pending.delete(recipient.userId);
    },
  };
}
