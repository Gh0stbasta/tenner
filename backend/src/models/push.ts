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

/** A snoozed push reminder (NOTIFICATION-011): the notifier sends the Tenner again at `remindAt`. */
export interface PushSnooze {
  readonly userId: UserId;
  readonly tennerId: string;
  /** Due date of the snoozed cycle; a completed Tenner is not reminded again. */
  readonly nextDue: string;
  /** UTC timestamp. */
  readonly remindAt: string;
  readonly createdAt: string;
}

export const MAX_PUSH_SNOOZES = 100;

/** „Später“ in a push notification: in 1 hour, this evening (evening reminder time) or tomorrow morning (digest time). */
export const PUSH_SNOOZE_OPTIONS = ["1H", "EVENING", "TOMORROW"] as const;
export type PushSnoozeOption = (typeof PUSH_SNOOZE_OPTIONS)[number];
