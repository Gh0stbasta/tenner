/** DynamoDB implementation of the household settings store (table tenner-households, key tenantId). */

import { GetCommand, UpdateCommand, type GetCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { PersistenceError } from "../../exceptions/index.js";
import {
  CATEGORY_ICONS,
  CATEGORY_ID_PATTERN,
  MEMBER_COLORS,
  USER_ID_PATTERN,
  ALEXA_PERSON_ID_PATTERN,
  ALEXA_USER_ID_PATTERN,
  WEEK_STARTS,
  WEEKDAYS,
  type CategoryIcon,
  type AlexaSpeaker,
  type AlexaUser,
  type PushSnooze,
  type PushSubscriptionRecord,
  type NotificationPreferences,
  type NotificationPreferencesByMember,
  type Handover,
  type HouseholdCategory,
  type HouseholdMember,
  type HouseholdSettings,
  type HouseholdSettingsChange,
  type MemberColor,
  type NewTennerDefaults,
  type WeekStart,
  type UserId,
  type Vacation,
} from "../../models/index.js";
import type { HouseholdRepository } from "../household.repository.js";
import { toConflictOrPersistenceError, toPersistenceError } from "./errors.js";

function toVacation(value: unknown): Vacation | null {
  if (typeof value !== "object" || value === null) return null;
  const { from, until, categories } = value as Record<string, unknown>;
  if (typeof from !== "string" || typeof until !== "string") return null;
  const valid = Array.isArray(categories) ? categories.filter((category): category is string => typeof category === "string" && CATEGORY_ID_PATTERN.test(category)) : null;
  return { from, until, categories: valid !== null && valid.length > 0 ? valid : null };
}

/** Stored members; malformed entries are dropped, unknown colors read as GREY. */
function toMembers(value: unknown): HouseholdMember[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry): HouseholdMember[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { userId, displayName, color, active, canSignIn, createdAt, updatedAt } = entry as Record<string, unknown>;
    if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId) || typeof displayName !== "string") return [];
    return [
      {
        userId,
        displayName,
        color: colorOf(color),
        active: active !== false,
        // Members stored before HOUSEHOLD-ADMIN-006 can sign in.
        canSignIn: canSignIn !== false,
        createdAt: typeof createdAt === "string" ? createdAt : "",
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      },
    ];
  });
}

const colorOf = (value: unknown): MemberColor => ((MEMBER_COLORS as readonly unknown[]).includes(value) ? (value as MemberColor) : "GREY");

/** Stored categories; malformed entries are dropped, unknown icons read as STAR. */
function toCategories(value: unknown): HouseholdCategory[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry, index): HouseholdCategory[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { categoryId, name, icon, color, sortOrder, archived, createdAt, updatedAt } = entry as Record<string, unknown>;
    if (typeof categoryId !== "string" || !CATEGORY_ID_PATTERN.test(categoryId) || typeof name !== "string") return [];
    return [
      {
        categoryId,
        name,
        icon: (CATEGORY_ICONS as readonly unknown[]).includes(icon) ? (icon as CategoryIcon) : "STAR",
        color: colorOf(color),
        sortOrder: typeof sortOrder === "number" ? sortOrder : index,
        archived: archived === true,
        createdAt: typeof createdAt === "string" ? createdAt : "",
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      },
    ];
  });
}

/** Stored handovers; malformed entries are dropped (HOUSEHOLD-004). */
function toHandovers(value: unknown): Handover[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Handover[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { from, to, until, categories, createdAt, createdBy } = entry as Record<string, unknown>;
    if (typeof from !== "string" || !USER_ID_PATTERN.test(from) || typeof to !== "string" || !USER_ID_PATTERN.test(to) || typeof until !== "string") return [];
    const valid = Array.isArray(categories) ? categories.filter((category): category is string => typeof category === "string" && CATEGORY_ID_PATTERN.test(category)) : [];
    return [
      {
        from,
        to,
        until,
        categories: valid.length > 0 ? valid : null,
        createdAt: typeof createdAt === "string" ? createdAt : "",
        createdBy: typeof createdBy === "string" ? createdBy : "",
      },
    ];
  });
}

/** Stored Alexa speaker mappings; malformed entries are dropped (ALEXA-002). */
function toAlexaSpeakers(value: unknown): AlexaSpeaker[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): AlexaSpeaker[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { personId, userId, createdAt, createdBy } = entry as Record<string, unknown>;
    if (typeof personId !== "string" || !ALEXA_PERSON_ID_PATTERN.test(personId) || typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) return [];
    return [{ personId, userId, createdAt: typeof createdAt === "string" ? createdAt : "", createdBy: typeof createdBy === "string" ? createdBy : "" }];
  });
}

/** Stored push subscriptions; malformed entries are dropped (NOTIFICATION-009). */
function toPushSubscriptions(value: unknown): PushSubscriptionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PushSubscriptionRecord[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { userId, endpoint, p256dh, auth, createdAt } = entry as Record<string, unknown>;
    if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId) || typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") return [];
    return [{ userId, endpoint, p256dh, auth, createdAt: typeof createdAt === "string" ? createdAt : "" }];
  });
}

/** Stored push snoozes; malformed entries are dropped (NOTIFICATION-011). */
function toPushSnoozes(value: unknown): PushSnooze[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PushSnooze[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { userId, tennerId, nextDue, remindAt, createdAt } = entry as Record<string, unknown>;
    if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId) || typeof tennerId !== "string" || typeof nextDue !== "string" || typeof remindAt !== "string") return [];
    return [{ userId, tennerId, nextDue, remindAt, createdAt: typeof createdAt === "string" ? createdAt : "" }];
  });
}

/** Stored Alexa accounts; malformed entries are dropped (ALEXA-007). */
function toAlexaUsers(value: unknown): AlexaUser[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): AlexaUser[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { alexaUserId, linkedBy, createdAt } = entry as Record<string, unknown>;
    if (typeof alexaUserId !== "string" || !ALEXA_USER_ID_PATTERN.test(alexaUserId) || typeof linkedBy !== "string" || !USER_ID_PATTERN.test(linkedBy)) return [];
    return [{ alexaUserId, linkedBy, createdAt: typeof createdAt === "string" ? createdAt : "" }];
  });
}

/** Stored preferences per member; entries for invalid member IDs or without the expected shape are dropped. */
function toNotificationPreferences(value: unknown): NotificationPreferencesByMember {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, NotificationPreferences] =>
        USER_ID_PATTERN.test(entry[0]) && typeof entry[1] === "object" && entry[1] !== null && "dailyDigest" in entry[1] && "overdueAlerts" in entry[1],
    ),
  );
}

function toDefaults(value: unknown): NewTennerDefaults | null {
  if (typeof value !== "object" || value === null) return null;
  const { category, estimatedMinutes, frequencyDays } = value as Record<string, unknown>;
  if (typeof category !== "string" || !CATEGORY_ID_PATTERN.test(category) || typeof estimatedMinutes !== "number" || typeof frequencyDays !== "number") return null;
  return { category, estimatedMinutes, frequencyDays };
}

function toSettings(item: Record<string, unknown>): HouseholdSettings {
  const workdays = Array.isArray(item.workdays) ? WEEKDAYS.filter((day) => (item.workdays as unknown[]).includes(day)) : null;
  return {
    tenantId: String(item.tenantId),
    name: typeof item.name === "string" ? item.name : null,
    timezone: typeof item.timezone === "string" ? item.timezone : null,
    weekStartsOn: (WEEK_STARTS as readonly unknown[]).includes(item.weekStartsOn) ? (item.weekStartsOn as WeekStart) : null,
    workdays: workdays !== null && workdays.length > 0 ? workdays : null,
    defaults: toDefaults(item.defaults),
    vacation: toVacation(item.vacation),
    members: toMembers(item.members),
    membersVersion: typeof item.membersVersion === "number" ? item.membersVersion : 0,
    categories: toCategories(item.categories),
    categoriesVersion: typeof item.categoriesVersion === "number" ? item.categoriesVersion : 0,
    handovers: toHandovers(item.handovers),
    handoversVersion: typeof item.handoversVersion === "number" ? item.handoversVersion : 0,
    alexaSpeakers: toAlexaSpeakers(item.alexaSpeakers),
    alexaSpeakersVersion: typeof item.alexaSpeakersVersion === "number" ? item.alexaSpeakersVersion : 0,
    alexaUsers: toAlexaUsers(item.alexaUsers),
    alexaUsersVersion: typeof item.alexaUsersVersion === "number" ? item.alexaUsersVersion : 0,
    pushSubscriptions: toPushSubscriptions(item.pushSubscriptions),
    pushSubscriptionsVersion: typeof item.pushSubscriptionsVersion === "number" ? item.pushSubscriptionsVersion : 0,
    pushSnoozes: toPushSnoozes(item.pushSnoozes),
    pushSnoozesVersion: typeof item.pushSnoozesVersion === "number" ? item.pushSnoozesVersion : 0,
    notificationPreferences: toNotificationPreferences(item.notificationPreferences),
    notificationPreferencesVersion: typeof item.notificationPreferencesVersion === "number" ? item.notificationPreferencesVersion : 0,
    updatedAt: String(item.updatedAt),
    updatedBy: typeof item.updatedBy === "string" ? (item.updatedBy as UserId) : null,
  };
}

export class DynamoDbHouseholdRepository implements HouseholdRepository {
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
  ) {}

  async get(tenantId: string): Promise<HouseholdSettings | undefined> {
    try {
      const result = (await this.client.send(new GetCommand({ TableName: this.tableName, Key: { tenantId } }))) as GetCommandOutput;
      return result.Item ? toSettings(result.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("load household settings", error);
    }
  }

  /** Upsert of the given settings only, so other attributes (vacation, members, categories) are never overwritten. */
  async saveSettings(tenantId: string, changes: HouseholdSettingsChange, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    return this.saveAttributes(tenantId, Object.fromEntries(entries), actor, timestamp);
  }

  /** Upsert of the vacation only (SCHEDULING-005); null ends it. */
  async saveVacation(tenantId: string, vacation: Vacation | null, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveAttributes(tenantId, { vacation }, actor, timestamp);
  }

  /** Replace the member list with optimistic locking on membersVersion (HOUSEHOLD-ADMIN-001). */
  async saveMembers(tenantId: string, members: readonly HouseholdMember[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "members", members, expectedVersion, actor, timestamp);
  }

  /** Replace the category list with optimistic locking on categoriesVersion (HOUSEHOLD-ADMIN-002). */
  async saveCategories(tenantId: string, categories: readonly HouseholdCategory[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "categories", categories, expectedVersion, actor, timestamp);
  }

  /** Replace the handover list with optimistic locking on handoversVersion (HOUSEHOLD-004). */
  async saveHandovers(tenantId: string, handovers: readonly Handover[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "handovers", handovers, expectedVersion, actor, timestamp);
  }

  /** Replace the notification preferences map with optimistic locking (NOTIFICATION-002). */
  async saveNotificationPreferences(
    tenantId: string,
    preferences: NotificationPreferencesByMember,
    expectedVersion: number,
    actor: UserId,
    timestamp: string,
  ): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "notificationPreferences", preferences, expectedVersion, actor, timestamp);
  }

  /** Replace the Alexa accounts with optimistic locking (ALEXA-007). */
  async saveAlexaUsers(tenantId: string, users: readonly AlexaUser[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "alexaUsers", users, expectedVersion, actor, timestamp);
  }

  /** Replace the push snoozes with optimistic locking (NOTIFICATION-011). */
  async savePushSnoozes(tenantId: string, snoozes: readonly PushSnooze[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "pushSnoozes", snoozes, expectedVersion, actor, timestamp);
  }

  /** Replace the push subscriptions with optimistic locking (NOTIFICATION-009). */
  async savePushSubscriptions(tenantId: string, subscriptions: readonly PushSubscriptionRecord[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "pushSubscriptions", subscriptions, expectedVersion, actor, timestamp);
  }

  /** Replace the Alexa speaker mappings with optimistic locking on alexaSpeakersVersion (ALEXA-002). */
  async saveAlexaSpeakers(tenantId: string, speakers: readonly AlexaSpeaker[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "alexaSpeakers", speakers, expectedVersion, actor, timestamp);
  }

  /** SET <list> (a list or map) and <list>Version = expected + 1, if the stored version still equals `expectedVersion` (0 = none). */
  private async saveVersionedList(
    tenantId: string,
    name: "members" | "categories" | "handovers" | "alexaSpeakers" | "notificationPreferences" | "alexaUsers" | "pushSubscriptions" | "pushSnoozes",
    list: readonly unknown[] | object,
    expectedVersion: number,
    actor: UserId,
    timestamp: string,
  ): Promise<HouseholdSettings> {
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId },
          UpdateExpression: "SET #list = :list, #version = :nextVersion, #updatedAt = :timestamp, #updatedBy = :actor",
          ConditionExpression: expectedVersion === 0 ? "attribute_not_exists(#version)" : "#version = :expectedVersion",
          ExpressionAttributeNames: { "#list": name, "#version": `${name}Version`, "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: {
            ":list": list,
            ":nextVersion": expectedVersion + 1,
            ":timestamp": timestamp,
            ":actor": actor,
            ...(expectedVersion === 0 ? {} : { ":expectedVersion": expectedVersion }),
          },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      attributes = result.Attributes;
    } catch (error) {
      throw toConflictOrPersistenceError(`save household ${name}`, `The household ${name} were changed by another request.`, error, "CONCURRENT_MODIFICATION");
    }
    if (!attributes) throw new PersistenceError(`Failed to save household ${name}.`);
    return toSettings(attributes);
  }

  private async saveAttributes(tenantId: string, values: Record<string, unknown>, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    const names = Object.keys(values);
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId },
          UpdateExpression: `SET ${[...names.map((name) => `#${name} = :${name}`), "#updatedAt = :timestamp", "#updatedBy = :actor"].join(", ")}`,
          ExpressionAttributeNames: { ...Object.fromEntries(names.map((name) => [`#${name}`, name])), "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: { ...Object.fromEntries(names.map((name) => [`:${name}`, values[name]])), ":timestamp": timestamp, ":actor": actor },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      attributes = result.Attributes;
    } catch (error) {
      throw toPersistenceError("save household settings", error);
    }
    if (!attributes) throw new PersistenceError("Failed to save household settings.");
    return toSettings(attributes);
  }
}
