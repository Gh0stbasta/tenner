import type { UserId } from "./enums.js";

/** A browser push subscription of a member (NOTIFICATION-009), stored on the household item. */
export interface PushSubscriptionRecord {
  readonly userId: UserId;
  /** Push service URL (a capability URL: never logged). */
  readonly endpoint: string;
  /** Base64url P-256 public key of the browser. */
  readonly p256dh: string;
  /** Base64url authentication secret. */
  readonly auth: string;
  readonly createdAt: string;
}

/** Devices per member (phone, tablet, desktop …); the oldest is replaced beyond this. */
export const MAX_PUSH_SUBSCRIPTIONS_PER_MEMBER = 5;
