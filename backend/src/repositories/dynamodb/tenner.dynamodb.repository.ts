/** DynamoDB implementation of the Tenner repository (table tenner-tenners). */

import { PutCommand, QueryCommand, UpdateCommand, type QueryCommandOutput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { PersistenceError } from "../../exceptions/index.js";
import type { Tenner } from "../../models/index.js";
import type { TennerCriteria, TennerRepository, TennerUpdate } from "../tenner.repository.js";
import { toConflictOrPersistenceError, toNotFoundOrPersistenceError, toPersistenceError } from "./errors.js";
import { toTenner } from "./tenner.mapper.js";
import { buildTennerQuery } from "./tenner.query.js";

/**
 * Implements the repository methods needed so far. Further methods are added by the tickets
 * that need them (TICKET-012 delete).
 */
export class DynamoDbTennerRepository implements Pick<TennerRepository, "save" | "list" | "update"> {
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
          ConditionExpression: "attribute_exists(tennerId)",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
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
}
