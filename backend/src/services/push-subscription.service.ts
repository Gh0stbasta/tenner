/**
 * Browser push subscriptions (NOTIFICATION-009): a member registers the devices that should receive Tenner pushes.
 * Only the member themselves can add or remove their devices; the notifier removes subscriptions the push service
 * reports as gone. Endpoints are capability URLs and are never logged or returned.
 */

import type { Identity } from "../auth/index.js";
import type { PushSubscriptionRequest } from "../dto/index.js";
import { ForbiddenError } from "../exceptions/index.js";
import { MAX_PUSH_SUBSCRIPTIONS_PER_MEMBER, type PushSubscriptionRecord, type UserId } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

const SYSTEM_ACTOR = "SYSTEM";

export class PushSubscriptionService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "savePushSubscriptions">,
    private readonly clock: Clock,
  ) {}

  async subscriptionsOf(tenantId: string, userId: UserId): Promise<readonly PushSubscriptionRecord[]> {
    return ((await this.households.get(tenantId))?.pushSubscriptions ?? []).filter((subscription) => subscription.userId === userId);
  }

  /** Add or refresh this device; beyond the limit the member's oldest device is dropped. Returns the device count. */
  async subscribe(identity: Identity, userId: UserId, request: PushSubscriptionRequest): Promise<number> {
    requireSelf(identity, userId);
    const settings = await this.households.get(identity.tenantId);
    const others = (settings?.pushSubscriptions ?? []).filter((subscription) => subscription.endpoint !== request.endpoint);
    const own = others.filter((subscription) => subscription.userId === userId);
    const dropped = own.slice(0, Math.max(0, own.length - (MAX_PUSH_SUBSCRIPTIONS_PER_MEMBER - 1)));
    const timestamp = toUtcTimestamp(this.clock());
    const record: PushSubscriptionRecord = { userId, endpoint: request.endpoint, p256dh: request.keys.p256dh, auth: request.keys.auth, createdAt: timestamp };
    const next = [...others.filter((subscription) => !dropped.includes(subscription)), record];
    await this.households.savePushSubscriptions(identity.tenantId, next, settings?.pushSubscriptionsVersion ?? 0, identity.userId, timestamp);
    return next.filter((subscription) => subscription.userId === userId).length;
  }

  /** Remove this device; no-op if it is not registered. */
  async unsubscribe(identity: Identity, userId: UserId, endpoint: string): Promise<void> {
    requireSelf(identity, userId);
    await this.removeWhere(identity.tenantId, identity.userId, (subscription) => subscription.userId === userId && subscription.endpoint === endpoint);
  }

  /** The push service no longer accepts this endpoint (404/410). */
  async removeGone(tenantId: string, endpoint: string): Promise<void> {
    await this.removeWhere(tenantId, SYSTEM_ACTOR, (subscription) => subscription.endpoint === endpoint);
  }

  private async removeWhere(tenantId: string, actor: UserId, match: (subscription: PushSubscriptionRecord) => boolean): Promise<void> {
    const settings = await this.households.get(tenantId);
    if (!settings || !settings.pushSubscriptions.some(match)) return;
    const timestamp = toUtcTimestamp(this.clock());
    await this.households.savePushSubscriptions(tenantId, settings.pushSubscriptions.filter((subscription) => !match(subscription)), settings.pushSubscriptionsVersion, actor, timestamp);
  }
}

function requireSelf(identity: Identity, userId: UserId): void {
  if (identity.userId !== userId) throw new ForbiddenError("Push devices can only be managed by the member themselves.");
}
