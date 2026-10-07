/**
 * Browser push as a notification channel (NOTIFICATION-009): every message goes to all registered devices of the
 * member. Subscriptions the push service reports as gone (404/410) are deleted. Endpoints and keys are never logged.
 */

import type { DeliveryResult, NotificationChannel, NotificationMessage, Recipient } from "../notifications/model.js";
import type { PushSubscriptionRecord, UserId } from "../models/index.js";
import { sendPush, type PushOutcome, type PushRequestOptions, type VapidKeys } from "./web-push.js";

/** What the service worker shows (frontend/public/push-sw.js). */
export interface PushPayload {
  readonly title: string;
  readonly body: string;
  /** Opened on tap (path or absolute URL of the web app). */
  readonly url: string;
  /** Replaces an older notification with the same tag on the device. */
  readonly tag: string;
}

/** Push services keep a message for an offline phone this long; a reminder is stale after half a day. */
export const PUSH_TTL_SECONDS = 12 * 3600;
const BODY_LIMIT = 300;

export interface WebPushChannelDependencies {
  readonly subscriptionsOf: (tenantId: string, userId: UserId) => Promise<readonly PushSubscriptionRecord[]>;
  readonly removeGone: (tenantId: string, endpoint: string) => Promise<void>;
  readonly vapidKeys: () => Promise<VapidKeys>;
  readonly appUrl: string | undefined;
  readonly now: () => Date;
  readonly send?: (subscription: PushSubscriptionRecord, payload: PushPayload, keys: VapidKeys, options: PushRequestOptions, now: Date) => Promise<PushOutcome>;
}

/** One notification for the whole message (the per-Tenner reminders follow with NOTIFICATION-010). */
export function payloadsOf(message: NotificationMessage, appUrl: string | undefined): PushPayload[] {
  const body = message.textBody.length > BODY_LIMIT ? `${message.textBody.slice(0, BODY_LIMIT - 1)}…` : message.textBody;
  return [{ title: message.subject, body, url: message.deepLink ?? appUrl ?? "/", tag: message.type }];
}

export class WebPushChannel implements NotificationChannel {
  readonly type = "WEB_PUSH" as const;

  constructor(private readonly deps: WebPushChannelDependencies) {}

  async send(message: NotificationMessage, recipient: Recipient): Promise<DeliveryResult> {
    const subscriptions = await this.deps.subscriptionsOf(recipient.tenantId, recipient.userId);
    if (subscriptions.length === 0) return { status: "SKIPPED", errorCode: "NO_PUSH_DEVICE" };
    const keys = await this.deps.vapidKeys();
    const send =
      this.deps.send ??
      ((subscription, payload, vapid, options, now) => sendPush({ endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth }, payload, vapid, options, now));
    const now = this.deps.now();
    let delivered = 0;
    let lastStatus: number | undefined;
    for (const subscription of subscriptions) {
      for (const payload of payloadsOf(message, this.deps.appUrl)) {
        const outcome = await send(subscription, payload, keys, { ttlSeconds: PUSH_TTL_SECONDS, urgency: "normal" }, now);
        if (outcome.ok) {
          delivered += 1;
          continue;
        }
        lastStatus = outcome.status;
        if (outcome.gone) {
          await this.deps.removeGone(recipient.tenantId, subscription.endpoint);
          break;
        }
      }
    }
    return delivered > 0 ? { status: "SENT" } : { status: "FAILED", errorCode: lastStatus === undefined ? "PUSH_UNREACHABLE" : `PUSH_HTTP_${lastStatus}` };
  }
}
