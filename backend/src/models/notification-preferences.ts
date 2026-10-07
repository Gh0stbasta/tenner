import type { UserId, Weekday } from "./enums.js";

/**
 * Channels a member can choose for notifications (NOTIFICATION-002); LOG is internal and never selectable.
 * Alexa (ALEXA-008) and browser push (NOTIFICATION-009, re-added by the owner on 2026-10-07).
 */
export const USER_CHANNELS = ["ALEXA", "WEB_PUSH"] as const;
export type UserChannel = (typeof USER_CHANNELS)[number];

/** Per-member notification preferences (NOTIFICATION-002), stored on the household item. */
export interface NotificationPreferences {
  /** IANA timezone for send times; null = the household timezone. */
  readonly timezone: string | null;
  readonly dailyDigest: { readonly enabled: boolean; readonly time: string; readonly channels: readonly UserChannel[] };
  /** `time`: local time of the evening reminder (NOTIFICATION-010; before that a fixed 17:00). */
  readonly overdueAlerts: { readonly enabled: boolean; readonly minDaysOverdue: number; readonly time: string; readonly channels: readonly UserChannel[] };
  readonly weeklySummary: { readonly enabled: boolean; readonly dayOfWeek: Weekday; readonly time: string; readonly channels: readonly UserChannel[] };
  /** No notifications in this local range (may wrap midnight); null = none. */
  readonly quietHours: { readonly start: string; readonly end: string } | null;
}

/** NOTIFICATION-010 (docs/human/mobileReminder.md): morning reminder 08:00, evening reminder for overdue Tenners 18:00. */
export const DEFAULT_DIGEST_TIME = "08:00";
export const DEFAULT_OVERDUE_ALERT_TIME = "18:00";

/** Defaults: most members never change them ("Simplicity First"). Channels stay empty until one is connected. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  timezone: null,
  dailyDigest: { enabled: true, time: DEFAULT_DIGEST_TIME, channels: [] },
  overdueAlerts: { enabled: true, minDaysOverdue: 2, time: DEFAULT_OVERDUE_ALERT_TIME, channels: [] },
  weeklySummary: { enabled: false, dayOfWeek: "SUN", time: "18:00", channels: [] },
  quietHours: { start: "21:30", end: "07:00" },
};

/** Stored preferences from before NOTIFICATION-010 have no overdue alert time: they get the default. */
export function withPreferenceDefaults(preferences: NotificationPreferences): NotificationPreferences {
  return { ...preferences, overdueAlerts: { ...preferences.overdueAlerts, time: preferences.overdueAlerts.time ?? DEFAULT_OVERDUE_ALERT_TIME } };
}

export type NotificationPreferencesByMember = Readonly<Partial<Record<UserId, NotificationPreferences>>>;
