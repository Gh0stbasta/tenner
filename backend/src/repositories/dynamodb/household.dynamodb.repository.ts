/** DynamoDB implementation of the household settings store (table tenner-households, key tenantId). */

import { GetCommand, UpdateCommand, type GetCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { PersistenceError } from "../../exceptions/index.js";
import { CATEGORIES, type Category, type HouseholdSettings, type UserId, type Vacation } from "../../models/index.js";
import type { HouseholdRepository } from "../household.repository.js";
import { toPersistenceError } from "./errors.js";

function toVacation(value: unknown): Vacation | null {
  if (typeof value !== "object" || value === null) return null;
  const { from, until, categories } = value as Record<string, unknown>;
  if (typeof from !== "string" || typeof until !== "string") return null;
  const valid = Array.isArray(categories) ? CATEGORIES.filter((category: Category) => categories.includes(category)) : null;
  return { from, until, categories: valid !== null && valid.length > 0 ? valid : null };
}

function toSettings(item: Record<string, unknown>): HouseholdSettings {
  return {
    tenantId: String(item.tenantId),
    timezone: typeof item.timezone === "string" ? item.timezone : null,
    vacation: toVacation(item.vacation),
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
