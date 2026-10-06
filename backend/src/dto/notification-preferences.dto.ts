import type { NotificationPreferences, UserChannel } from "../models/index.js";

/** GET/PUT /users/{userId}/notification-preferences (NOTIFICATION-002). */
export interface NotificationPreferencesResponse {
  readonly preferences: NotificationPreferences;
  /** Connection status per channel (connection flows are added by the channel tickets). */
  readonly channels: readonly { readonly type: UserChannel; readonly connected: boolean }[];
  /** Effective timezone for send times (own or household). */
  readonly effectiveTimezone: string;
}

export type UpdateNotificationPreferencesRequest = NotificationPreferences;
