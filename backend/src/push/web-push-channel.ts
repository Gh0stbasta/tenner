/**
 * Browser push as a notification channel (NOTIFICATION-009): every message goes to all registered devices of the
 * member. Subscriptions the push service reports as gone (404/410) are deleted. Endpoints and keys are never logged.
 */

import type { DeliveryResult, NotificationChannel, NotificationItem, NotificationMessage, Recipient } from "../notifications/model.js";
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
  /** The Tenner of a per-Tenner reminder (NOTIFICATION-010). */
  readonly tennerId?: string;
  /** Buttons with signed action tokens (NOTIFICATION-011), sent by the service worker to `actionUrl`. */
  readonly actions?: readonly { readonly action: "done" | "snooze"; readonly title: string; readonly token: string }[];
  readonly actionUrl?: string;
}

/** Signs one action token for a member, Tenner and cycle (NOTIFICATION-011). */
export type SignAction = (claims: { tenantId: string; userId: string; tennerId: string; nextDue: string; action: "DONE" | "SNOOZE" }) => Promise<string>;

/** At most this many reminders per message; the rest is summarised in one more notification. */
export const MAX_PUSH_ITEMS = 8;

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
  /** NOTIFICATION-011: action buttons; without them the notifications only open the app. */
  readonly actions?: { readonly apiUrl: string; readonly sign: SignAction };
}

/** „✅ Erledigt“ and „⏰ Später“ on every per-Tenner reminder (Android shows two buttons; iOS none, tap opens). */
export async function withActions(payload: PushPayload, item: NotificationItem, recipient: Recipient, actions: NonNullable<WebPushChannelDependencies["actions"]>): Promise<PushPayload> {
  const claims = { tenantId: recipient.tenantId, userId: recipient.userId, tennerId: item.tennerId, nextDue: item.nextDue };
  return {
    ...payload,
    actionUrl: `${actions.apiUrl}/push-actions`,
    actions: [
      { action: "done", title: "✅ Erledigt", token: await actions.sign({ ...claims, action: "DONE" }) },
      { action: "snooze", title: "⏰ Später", token: await actions.sign({ ...claims, action: "SNOOZE" }) },
    ],
  };
}

const minutesText = (minutes: number): string => `${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`;
const daysText = (days: number): string => `${days} ${days === 1 ? "Tag" : "Tagen"}`;

/**
 * NOTIFICATION-010: one notification per Tenner (docs/human/mobileReminder.md: „🏠 Tenner · Heute: … · Geschätzter
 * Aufwand: 10 Minuten“), tagged per Tenner so a newer reminder replaces an older one. Messages without items (e.g.
 * the weekly summary) stay one notification.
 */
export function payloadsOf(message: NotificationMessage, appUrl: string | undefined): PushPayload[] {
  const base = appUrl ?? "";
  const items = message.items ?? [];
  if (items.length === 0) {
    const body = message.textBody.length > BODY_LIMIT ? `${message.textBody.slice(0, BODY_LIMIT - 1)}…` : message.textBody;
    return [{ title: message.subject, body, url: message.deepLink ?? appUrl ?? "/", tag: message.type }];
  }
  const payloads: PushPayload[] = items.slice(0, MAX_PUSH_ITEMS).map((item) => ({
    title: "🏠 Tenner",
    body: [
      item.overdueDays === undefined ? `Heute: ${item.title}` : `Überfällig seit ${daysText(item.overdueDays)}: ${item.title}`,
      `Geschätzter Aufwand: ${minutesText(item.estimatedMinutes)}`,
    ].join("\n"),
    url: `${base}/tenners/${encodeURIComponent(item.tennerId)}`,
    tag: `tenner-${item.tennerId}`,
    tennerId: item.tennerId,
  }));
  if (items.length > MAX_PUSH_ITEMS) {
    payloads.push({ title: "🏠 Tenner", body: `+${items.length - MAX_PUSH_ITEMS} weitere Tenner`, url: `${base}/dashboard`, tag: message.type });
  }
  return payloads;
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
    // Tokens are signed once per message and Tenner, the same for all devices.
    const payloads = await Promise.all(
      payloadsOf(message, this.deps.appUrl).map((payload) => {
        const item = message.items?.find((candidate) => candidate.tennerId === payload.tennerId);
        return item && this.deps.actions ? withActions(payload, item, recipient, this.deps.actions) : payload;
      }),
    );
    for (const subscription of subscriptions) {
      for (const payload of payloads) {
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
