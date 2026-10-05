/** DynamoDB implementation of the household settings store (table tenner-households, key tenantId). */

import { GetCommand, UpdateCommand, type GetCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { PersistenceError } from "../../exceptions/index.js";
import {
  CATEGORY_ICONS,
  CATEGORY_ID_PATTERN,
  MEMBER_COLORS,
  USER_ID_PATTERN,
  type CategoryIcon,
  type HouseholdCategory,
  type HouseholdMember,
  type HouseholdSettings,
  type MemberColor,
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
    const { userId, displayName, color, active, createdAt, updatedAt } = entry as Record<string, unknown>;
    if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId) || typeof displayName !== "string") return [];
    return [
      {
        userId,
        displayName,
        color: colorOf(color),
        active: active !== false,
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

function toSettings(item: Record<string, unknown>): HouseholdSettings {
  return {
    tenantId: String(item.tenantId),
    timezone: typeof item.timezone === "string" ? item.timezone : null,
    vacation: toVacation(item.vacation),
    members: toMembers(item.members),
    membersVersion: typeof item.membersVersion === "number" ? item.membersVersion : 0,
    categories: toCategories(item.categories),
    categoriesVersion: typeof item.categoriesVersion === "number" ? item.categoriesVersion : 0,
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

  /** Upsert of the timezone only, so other settings (vacation, HOUSEHOLD-ADMIN-003) are never overwritten. */
  async saveTimezone(tenantId: string, timezone: string, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveAttribute(tenantId, "timezone", timezone, actor, timestamp);
  }

  /** Upsert of the vacation only (SCHEDULING-005); null ends it. */
  async saveVacation(tenantId: string, vacation: Vacation | null, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveAttribute(tenantId, "vacation", vacation, actor, timestamp);
  }

  /** Replace the member list with optimistic locking on membersVersion (HOUSEHOLD-ADMIN-001). */
  async saveMembers(tenantId: string, members: readonly HouseholdMember[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "members", members, expectedVersion, actor, timestamp);
  }

  /** Replace the category list with optimistic locking on categoriesVersion (HOUSEHOLD-ADMIN-002). */
  async saveCategories(tenantId: string, categories: readonly HouseholdCategory[], expectedVersion: number, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    return this.saveVersionedList(tenantId, "categories", categories, expectedVersion, actor, timestamp);
  }

  /** SET <list> and <list>Version = expected + 1, if the stored version still equals `expectedVersion` (0 = none). */
  private async saveVersionedList(
    tenantId: string,
    name: "members" | "categories",
    list: readonly unknown[],
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

  private async saveAttribute(tenantId: string, name: "timezone" | "vacation", value: unknown, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId },
          UpdateExpression: "SET #value = :value, #updatedAt = :timestamp, #updatedBy = :actor",
          ExpressionAttributeNames: { "#value": name, "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: { ":value": value, ":timestamp": timestamp, ":actor": actor },
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
