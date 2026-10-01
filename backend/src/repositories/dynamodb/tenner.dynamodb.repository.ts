/** DynamoDB implementation of the Tenner repository (table tenner-tenners). */

import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type GetCommandOutput, type QueryCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { ConflictError, NotFoundError, PersistenceError } from "../../exceptions/index.js";
import type { Tenner } from "../../models/index.js";
import type { SoftDeleteResult, TennerCriteria, TennerRepository, TennerUpdate } from "../tenner.repository.js";
import { isConditionalCheckFailed, toConflictOrPersistenceError, toNotFoundOrPersistenceError, toPersistenceError } from "./errors.js";
import { toTenner } from "./tenner.mapper.js";
import { buildTennerQuery, NOT_DELETED } from "./tenner.query.js";

/**
 * DynamoDB Tenner repository. Deletes are soft deletes only; DeleteItem is never used (TICKET-012).
 */
export class DynamoDbTennerRepository implements TennerRepository {
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
  ) {}

  /** Insert a new Tenner. Never overwrites an existing item (ConflictError). */
  async save(tenner: Tenner): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...tenner },
          ConditionExpression: "attribute_not_exists(tennerId)",
        }),
      );
    } catch (error) {
      throw toConflictOrPersistenceError("save Tenner", "Tenner already exists.", error);
    }
  }

  /** Query all matching Tenners of a tenant, following pagination. */
  async list(tenantId: string, criteria: TennerCriteria = {}): Promise<Tenner[]> {
    const input = buildTennerQuery(this.tableName, tenantId, criteria);
    const tenners: Tenner[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    try {
      do {
        const page = (await this.client.send(
          new QueryCommand({ ...input, ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}) }),
        )) as QueryCommandOutput;
        for (const item of page.Items ?? []) tenners.push(toTenner(item));
        exclusiveStartKey = page.LastEvaluatedKey;
      } while (exclusiveStartKey);
    } catch (error) {
      throw toPersistenceError("list Tenners", error);
    }
    return tenners;
  }

  /** UpdateItem with SET for the given fields only; the item must exist. Returns the updated Tenner. */
  async update(tenantId: string, tennerId: string, changes: TennerUpdate): Promise<Tenner> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    const names = Object.fromEntries(entries.map(([key]) => [`#${key}`, key]));
    const values = Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value]));
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId, tennerId },
          UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
          // Soft-deleted Tenners are treated as not found (restore via TICKET-015).
          ConditionExpression: `attribute_exists(tennerId) AND ${NOT_DELETED}`,
          ExpressionAttributeNames: { ...names, "#deletedAt": "deletedAt" },
          ExpressionAttributeValues: { ...values, ":null": null },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      attributes = result.Attributes;
    } catch (error) {
      throw toNotFoundOrPersistenceError("update Tenner", "Tenner not found.", error);
    }
    // ALL_NEW on an existing item always returns attributes; anything else is a storage contract violation.
    if (!attributes) throw new PersistenceError("Failed to update Tenner.");
    return toTenner(attributes);
  }

  async getById(tenantId: string, tennerId: string): Promise<Tenner | undefined> {
    try {
      const result = (await this.client.send(
        new GetCommand({ TableName: this.tableName, Key: { tenantId, tennerId }, ConsistentRead: true }),
      )) as GetCommandOutput;
      return result.Item ? toTenner(result.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("load Tenner", error);
    }
  }

  async delete(tenantId: string, tennerId: string, timestamp: string): Promise<SoftDeleteResult> {
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId, tennerId },
          UpdateExpression: "SET #active = :false, #deletedAt = :timestamp, #updatedAt = :timestamp",
          ConditionExpression: `attribute_exists(tennerId) AND ${NOT_DELETED}`,
          ExpressionAttributeNames: { "#active": "active", "#deletedAt": "deletedAt", "#updatedAt": "updatedAt" },
          ExpressionAttributeValues: { ":false": false, ":timestamp": timestamp, ":null": null },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      if (!result.Attributes) throw new PersistenceError("Failed to delete Tenner.");
      return { status: "DELETED", tenner: toTenner(result.Attributes) };
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      if (!isConditionalCheckFailed(error)) throw toPersistenceError("delete Tenner", error);
    }
    // Condition failed: either missing or already deleted.
    const existing = await this.getById(tenantId, tennerId);
    if (!existing) throw new NotFoundError("Tenner not found.");
    if (existing.deletedAt === null) throw new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION");
    return { status: "ALREADY_DELETED", tenner: existing };
  }
}
