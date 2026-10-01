/** DynamoDB implementation of the Tenner repository (table tenner-tenners). */

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import type { Tenner } from "../../models/index.js";
import type { TennerRepository } from "../tenner.repository.js";
import { toConflictOrPersistenceError } from "./errors.js";

/**
 * Implements the repository methods needed so far. Further methods are added by the tickets
 * that need them (TICKET-010 list, TICKET-011 update, TICKET-012 delete).
 */
export class DynamoDbTennerRepository implements Pick<TennerRepository, "save"> {
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
}
