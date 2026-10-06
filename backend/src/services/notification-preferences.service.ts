/**
 * Notification preferences per member (NOTIFICATION-002). Members read and change only their own preferences; the
 * notifier reads everybody's through `preferencesOf`. Channel addresses are not stored here (channel tickets).
 */

import type { Identity } from "../auth/index.js";
import type { NotificationPreferencesResponse } from "../dto/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES, SEED_MEMBERS, USER_CHANNELS, type NotificationPreferences, type UserChannel, type UserId } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";
import type { TimeZoneSource } from "../utils/timezone.js";

/** Channels a member has connected (ALEXA-008 adds Alexa; NOTIFICATION-005 – 007 the others). */
export type ConnectedChannels = (tenantId: string, userId: UserId) => Promise<readonly UserChannel[]>;

export class NotificationPreferencesService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "saveNotificationPreferences">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
    private readonly connectedChannels: ConnectedChannels = async () => [],
  ) {}

  /** Stored preferences or the defaults (for the notifier). */
  async preferencesOf(tenantId: string, userId: UserId): Promise<NotificationPreferences> {
    return (await this.households.get(tenantId))?.notificationPreferences[userId] ?? DEFAULT_NOTIFICATION_PREFERENCES;
  }

  async get(identity: Identity, userId: UserId): Promise<NotificationPreferencesResponse> {
    await this.requireSelf(identity, userId);
    return this.respond(identity.tenantId, userId, await this.preferencesOf(identity.tenantId, userId));
  }

  /** Replace the member's preferences; channels must be connected. */
  async update(identity: Identity, userId: UserId, preferences: NotificationPreferences): Promise<NotificationPreferencesResponse> {
    await this.requireSelf(identity, userId);
    const connected = await this.connectedChannels(identity.tenantId, userId);
    const chosen = [...preferences.dailyDigest.channels, ...preferences.overdueAlerts.channels, ...preferences.weeklySummary.channels];
    const unconnected = [...new Set(chosen.filter((channel) => !connected.includes(channel)))];
    if (unconnected.length > 0) {
      throw new ValidationError("Invalid notification preferences.", [{ field: "channels", message: `Not connected: ${unconnected.join(", ")}.` }]);
    }
    const settings = await this.households.get(identity.tenantId);
    const saved = await this.households.saveNotificationPreferences(
      identity.tenantId,
      { ...(settings?.notificationPreferences ?? {}), [userId]: preferences },
      settings?.notificationPreferencesVersion ?? 0,
      identity.userId,
      toUtcTimestamp(this.clock()),
    );
    return this.respond(identity.tenantId, userId, saved.notificationPreferences[userId] ?? preferences);
  }

  /** Preferences are personal: only the member themselves (403); unknown members → 404. */
  private async requireSelf(identity: Identity, userId: UserId): Promise<void> {
    if (userId !== identity.userId) throw new ForbiddenError("Notification preferences can only be managed by the member themselves.");
    const members = (await this.households.get(identity.tenantId))?.members ?? SEED_MEMBERS;
    if (!members.some((member) => member.userId === userId)) throw new NotFoundError("Household member not found.");
  }

  private async respond(tenantId: string, userId: UserId, preferences: NotificationPreferences): Promise<NotificationPreferencesResponse> {
    const connected = await this.connectedChannels(tenantId, userId);
    return {
      preferences,
      channels: USER_CHANNELS.map((type) => ({ type, connected: connected.includes(type) })),
      effectiveTimezone: preferences.timezone ?? (await this.timezoneOf(tenantId)),
    };
  }
}
