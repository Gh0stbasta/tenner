/** Notification model (NOTIFICATION-001): channel-independent messages, recipients and delivery results. */

import type { UserId } from "../models/index.js";

/** SNOOZED_REMINDER: a push reminder again after „Später“ (NOTIFICATION-011). */
export const NOTIFICATION_TYPES = ["DAILY_DIGEST", "OVERDUE_ALERT", "WEEKLY_SUMMARY", "SNOOZED_REMINDER"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** LOG is the test/dry-run channel; ALEXA is added by ALEXA-008, WEB_PUSH by NOTIFICATION-009. */
export const CHANNEL_TYPES = ["LOG", "ALEXA", "WEB_PUSH"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

/** Rendered content; channels decide how to present it. No personal data beyond names and Tenner titles. */
export interface NotificationMessage {
  readonly type: NotificationType;
  readonly userId: UserId;
  readonly subject: string;
  readonly textBody: string;
  readonly deepLink?: string;
  /** Structured content for channels that cannot send free text (Alexa notifications, ALEXA-008). */
  readonly facts?: Readonly<Record<string, number | string>>;
  /** The Tenners the message is about, for channels that notify per Tenner (browser push, NOTIFICATION-010). */
  readonly items?: readonly NotificationItem[];
}

export interface NotificationItem {
  readonly tennerId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  /** Overdue alerts only. */
  readonly overdueDays?: number;
  /** The Tenner's due date the notification refers to (its cycle; NOTIFICATION-011 actions). */
  readonly nextDue: string;
}

export interface Recipient {
  readonly tenantId: string;
  readonly userId: UserId;
  readonly displayName: string;
  readonly timezone: string;
}

export type DeliveryStatus = "SENT" | "FAILED" | "SKIPPED";

export interface DeliveryResult {
  readonly status: DeliveryStatus;
  /** Machine-readable reason for FAILED/SKIPPED (no secrets, no tokens). */
  readonly errorCode?: string;
}

export interface NotificationChannel {
  readonly type: ChannelType;
  send(message: NotificationMessage, recipient: Recipient): Promise<DeliveryResult>;
}

/** Deterministic deduplication key: one notification per key. */
export function notificationKey(parts: { tenantId: string; userId: string; type: string; channel: string; date: string; suffix?: string }): string {
  return [parts.tenantId, parts.userId, parts.type, parts.channel, parts.date, ...(parts.suffix === undefined ? [] : [parts.suffix])].join("#");
}
