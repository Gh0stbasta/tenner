/**
 * Delivery with deduplication and retries (NOTIFICATION-001). A delivery first claims its key in the delivery log
 * (conditional put), so a second notifier run never sends the same notification twice; failed deliveries can be
 * claimed again by a later run until MAX_TOTAL_ATTEMPTS.
 */

import type { Logger } from "../utils/logger.js";
import type { DeliveryResult, NotificationChannel, NotificationMessage, Recipient } from "./model.js";

export const ATTEMPTS_PER_RUN = 3;
export const MAX_TOTAL_ATTEMPTS = 9;
export const DELIVERY_LOG_TTL_DAYS = 90;
const BACKOFF_MS = [200, 800];

export interface DeliveryRecord {
  readonly notificationKey: string;
  readonly type: string;
  readonly channel: string;
  readonly userId: string;
  readonly status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  readonly attempts: number;
  readonly errorCode: string | null;
  readonly createdAt: string;
  /** Epoch seconds (DynamoDB TTL). */
  readonly expiresAt: number;
}

export interface DeliveryLog {
  /** Claim the key; false if it was already delivered (or claimed by a running delivery). */
  claim(record: DeliveryRecord): Promise<boolean>;
  /** Final status after sending. */
  complete(notificationKey: string, status: DeliveryRecord["status"], attempts: number, errorCode: string | null): Promise<void>;
  /** True if a marker or delivery with this key exists (NOTIFICATION-004: Tenner already alerted in this cycle). */
  has(notificationKey: string): Promise<boolean>;
  /** The record with this key, if any (ALEXA-007: last widget push). */
  get(notificationKey: string): Promise<Pick<DeliveryRecord, "notificationKey" | "status" | "createdAt"> | undefined>;
  /** Record a marker (status SENT) without sending, e.g. "this Tenner was part of an alert". */
  mark(record: DeliveryRecord): Promise<void>;
}

/** A delivery record for `key`, created now, expiring after the TTL. */
export function deliveryRecord(key: string, fields: Pick<DeliveryRecord, "type" | "channel" | "userId">, now: Date, status: DeliveryRecord["status"] = "PENDING"): DeliveryRecord {
  return {
    notificationKey: key,
    ...fields,
    status,
    attempts: 0,
    errorCode: null,
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + DELIVERY_LOG_TTL_DAYS * 86_400,
  };
}

export interface DeliveryContext {
  readonly log: DeliveryLog;
  readonly logger: Logger;
  readonly now: () => Date;
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Deliver one message through one channel; never throws (failures are isolated and logged). */
export async function deliver(context: DeliveryContext, key: string, message: NotificationMessage, recipient: Recipient, channel: NotificationChannel): Promise<DeliveryResult> {
  const { log, logger } = context;
  const sleep = context.sleep ?? defaultSleep;
  const now = context.now();
  const fields = { notificationKey: key, type: message.type, channel: channel.type, userId: recipient.userId };
  try {
    const claimed = await log.claim(deliveryRecord(key, { type: message.type, channel: channel.type, userId: recipient.userId }, now));
    if (!claimed) {
      logger.debug("Notification already delivered", { event: "NotificationDuplicate", ...fields });
      return { status: "SKIPPED", errorCode: "DUPLICATE" };
    }
  } catch (error) {
    logger.error("Notification claim failed", { event: "NotificationClaimFailed", ...fields, error: error instanceof Error ? error.name : "UnknownError" });
    return { status: "FAILED", errorCode: "DELIVERY_LOG_UNAVAILABLE" };
  }

  let result: DeliveryResult = { status: "FAILED", errorCode: "NOT_ATTEMPTED" };
  let attempts = 0;
  while (attempts < ATTEMPTS_PER_RUN) {
    attempts += 1;
    try {
      result = await channel.send(message, recipient);
    } catch (error) {
      result = { status: "FAILED", errorCode: error instanceof Error ? error.name : "UnknownError" };
    }
    if (result.status !== "FAILED") break;
    if (attempts < ATTEMPTS_PER_RUN) await sleep(BACKOFF_MS[attempts - 1] ?? 1000);
  }
  try {
    await log.complete(key, result.status, attempts, result.errorCode ?? null);
  } catch (error) {
    logger.error("Notification status not recorded", { event: "NotificationLogFailed", ...fields, error: error instanceof Error ? error.name : "UnknownError" });
  }
  const level = result.status === "FAILED" ? "warn" : "info";
  logger[level]("Notification delivery", { event: "NotificationDelivery", ...fields, status: result.status, attempts, errorCode: result.errorCode });
  return result;
}
