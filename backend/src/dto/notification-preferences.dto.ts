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

/** PUT /users/{userId}/push-subscription (NOTIFICATION-009): the browser's PushSubscription.toJSON(). */
export interface PushSubscriptionRequest {
  readonly endpoint: string;
  readonly expirationTime?: number | null | undefined;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/** DELETE /users/{userId}/push-subscription. */
export interface RemovePushSubscriptionRequest {
  readonly endpoint: string;
}

export interface PushSubscriptionResponse {
  /** Registered devices of the member after the change. */
  readonly devices: number;
}
