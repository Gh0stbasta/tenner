/** Notification preferences of the signed-in member (NOTIFICATION-002). Stored server-side for the notifier. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { WEEKDAYS } from "../../types/domain";

/** Alexa (ALEXA-008) and browser push (NOTIFICATION-009). */
export const USER_CHANNELS = ["ALEXA", "WEB_PUSH"] as const;
export type UserChannel = (typeof USER_CHANNELS)[number];

export const CHANNEL_LABELS: Record<UserChannel, string> = {
  ALEXA: "Alexa",
  WEB_PUSH: "Push aufs Handy",
};

const channelsSchema = z.array(z.enum(USER_CHANNELS));

const preferencesSchema = z.object({
  timezone: z.string().nullable(),
  dailyDigest: z.object({ enabled: z.boolean(), time: z.string(), channels: channelsSchema }),
  /** „Essensplan am Morgen“ (FOOD-016); default for servers before it. */
  mealToday: z
    .object({ enabled: z.boolean(), time: z.string(), channels: channelsSchema })
    .default({ enabled: true, time: "07:30", channels: [] }),
  // NOTIFICATION-010: evening reminder time (default 18:00).
  overdueAlerts: z.object({
    enabled: z.boolean(),
    minDaysOverdue: z.number(),
    time: z.string(),
    channels: channelsSchema,
  }),
  weeklySummary: z.object({
    enabled: z.boolean(),
    dayOfWeek: z.enum(WEEKDAYS),
    time: z.string(),
    channels: channelsSchema,
  }),
  quietHours: z.object({ start: z.string(), end: z.string() }).nullable(),
  /** NOTIFICATION-011: what „Später“ in a push notification does. */
  pushSnooze: z.enum(["1H", "EVENING", "TOMORROW"]),
});
export type NotificationPreferences = z.infer<typeof preferencesSchema>;

const responseSchema = z.object({
  preferences: preferencesSchema,
  channels: z.array(z.object({ type: z.enum(USER_CHANNELS), connected: z.boolean() })),
  effectiveTimezone: z.string(),
});
export type NotificationPreferencesResponse = z.infer<typeof responseSchema>;

export const PUSH_SNOOZE_LABELS: Record<NotificationPreferences["pushSnooze"], string> = {
  "1H": "In 1 Stunde",
  EVENING: "Heute Abend (Uhrzeit der Überfällig-Hinweise)",
  TOMORROW: "Morgen früh (Uhrzeit des Tagesüberblicks)",
};

export const notificationPreferencesKey = (userId: string) => ["notification-preferences", userId] as const;
const keyOf = notificationPreferencesKey;
const pathOf = (userId: string) => `/users/${encodeURIComponent(userId)}/notification-preferences`;

export function useNotificationPreferences(userId: string) {
  return useQuery({
    queryKey: keyOf(userId),
    queryFn: () => apiClient.get(pathOf(userId), { schema: responseSchema }),
  });
}

export function useUpdateNotificationPreferences(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      apiClient.put(pathOf(userId), { schema: responseSchema, body: preferences }),
    onSuccess: (saved) => queryClient.setQueryData(keyOf(userId), saved),
  });
}

/** 00:00, 00:15, … 23:45 — the notifier runs every 15 minutes. */
export const QUARTER_HOURS: readonly string[] = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, "0");
  const minutes = String((index % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});
