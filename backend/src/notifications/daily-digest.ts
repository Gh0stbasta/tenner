/**
 * Daily digest (NOTIFICATION-003): at the member's configured time, what is due today, what is overdue and how long
 * it takes — own and shared Tenners, from the dashboard read model (no duplicated due/overdue rules). Empty days are
 * skipped; quiet hours are respected.
 */

import type { DashboardRequest, DashboardResponse } from "../dto/index.js";
import type { NotificationPreferences, UserId } from "../models/index.js";
import type { ChannelType, NotificationMessage, Recipient } from "./model.js";
import type { NotificationJob } from "./notifier.js";
import { inQuietHours, isDueAt, localTime } from "./schedule.js";
import { bulletList, daysText, greeting, tenners } from "./text.js";

export const DIGEST_ITEM_LIMIT = 10;

export interface DigestDependencies {
  readonly preferencesOf: (tenantId: string, userId: UserId) => Promise<NotificationPreferences>;
  readonly dashboard: (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;
  /** Web app URL for the deep link, if known. */
  readonly appUrl: string | undefined;
}

/** The member's own timezone if set, else the household's. */
export const timezoneFor = (preferences: NotificationPreferences, recipient: Recipient): string => preferences.timezone ?? recipient.timezone;

/** Every due notification is also written to the log channel, so a run is visible before a real channel exists. */
export const withLog = (channels: readonly ChannelType[]): ChannelType[] => ["LOG", ...channels];

export function renderDigest(dashboard: DashboardResponse, recipient: Recipient, localMinutes: number, appUrl: string | undefined): NotificationMessage | undefined {
  const due = dashboard.dueToday;
  const overdue = dashboard.overdue;
  if (due.length === 0 && overdue.length === 0) return undefined;
  const minutes = dashboard.summary.totalActionableMinutes;
  const lines = [`${greeting(localMinutes)}, ${recipient.displayName} ☀️`, ""];
  if (due.length > 0) {
    lines.push(`Heute (${tenners(due.length)} · ~${dashboard.summary.dueTodayMinutes} Min.)`, ...bulletList(due.map((tenner) => tenner.title), DIGEST_ITEM_LIMIT), "");
  }
  if (overdue.length > 0) {
    lines.push(`Überfällig (${overdue.length})`, ...bulletList(overdue.map((tenner) => `${tenner.title} — ${daysText(tenner.overdueDays ?? 1)}`), DIGEST_ITEM_LIMIT), "");
  }
  if (appUrl !== undefined) lines.push(`Tenner öffnen → ${appUrl}`);
  return {
    type: "DAILY_DIGEST",
    userId: recipient.userId,
    subject: `Heute: ${tenners(due.length)} · ~${minutes} Min.${overdue.length > 0 ? ` · ${overdue.length} überfällig` : ""}`,
    textBody: lines.join("\n").trimEnd(),
    ...(appUrl === undefined ? {} : { deepLink: appUrl }),
    facts: { dueToday: due.length, overdue: overdue.length, minutes },
  };
}

export function dailyDigestJob(deps: DigestDependencies): NotificationJob {
  return {
    type: "DAILY_DIGEST",
    async channelsDue(recipient, now) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const timezone = timezoneFor(preferences, recipient);
      if (!preferences.dailyDigest.enabled || !isDueAt(preferences.dailyDigest.time, now, timezone)) return [];
      if (inQuietHours(preferences.quietHours, now, timezone)) return [];
      return withLog(preferences.dailyDigest.channels);
    },
    async render(recipient, now) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const dashboard = await deps.dashboard(recipient.tenantId, { assignedTo: recipient.userId });
      return renderDigest(dashboard, recipient, localTime(now, timezoneFor(preferences, recipient)).minutes, deps.appUrl);
    },
  };
}
