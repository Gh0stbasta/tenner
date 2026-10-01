/** DynamoDB implementation of the Tenner repository (table tenner-tenners). */

import { PutCommand, QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import type { Tenner } from "../../models/index.js";
import type { TennerCriteria, TennerRepository } from "../tenner.repository.js";
import { toConflictOrPersistenceError, toPersistenceError } from "./errors.js";
import { toTenner } from "./tenner.mapper.js";
import { buildTennerQuery } from "./tenner.query.js";

/**
 * Implements the repository methods needed so far. Further methods are added by the tickets
 * that need them (TICKET-011 update, TICKET-012 delete).
 */
export class DynamoDbTennerRepository implements Pick<TennerRepository, "save" | "list"> {
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
}
