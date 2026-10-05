/** DynamoDB implementation of the household settings store (table tenner-households, key tenantId). */

import { GetCommand, UpdateCommand, type GetCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { PersistenceError } from "../../exceptions/index.js";
import type { HouseholdSettings, UserId } from "../../models/index.js";
import type { HouseholdRepository } from "../household.repository.js";
import { toPersistenceError } from "./errors.js";

function toSettings(item: Record<string, unknown>): HouseholdSettings {
  return {
    tenantId: String(item.tenantId),
    timezone: String(item.timezone),
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
      return result.Item && typeof result.Item.timezone === "string" ? toSettings(result.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("load household settings", error);
    }
  }

  /** Upsert of the timezone only, so later settings (HOUSEHOLD-ADMIN-003) are never overwritten. */
  async saveTimezone(tenantId: string, timezone: string, actor: UserId, timestamp: string): Promise<HouseholdSettings> {
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId },
          UpdateExpression: "SET #timezone = :timezone, #updatedAt = :timestamp, #updatedBy = :actor",
          ExpressionAttributeNames: { "#timezone": "timezone", "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: { ":timezone": timezone, ":timestamp": timestamp, ":actor": actor },
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
