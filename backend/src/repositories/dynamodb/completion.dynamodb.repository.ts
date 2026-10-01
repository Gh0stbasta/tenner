/** DynamoDB implementation of the completion history repository (table tenner-history). */

import { GetCommand, type GetCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import type { CompletionRecord, CompletionRepository } from "../completion.repository.js";
import { toCompletionRecord } from "./completion.mapper.js";
import { toPersistenceError } from "./errors.js";

/** History list queries follow with TICKET-020. */
export class DynamoDbCompletionRepository implements Pick<CompletionRepository, "getById"> {
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
  ) {}

  async getById(tenantId: string, completionId: string): Promise<CompletionRecord | undefined> {
    try {
      const result = (await this.client.send(
        new GetCommand({ TableName: this.tableName, Key: { tenantId, historyId: completionId }, ConsistentRead: true }),
      )) as GetCommandOutput;
      return result.Item ? toCompletionRecord(result.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("load completion", error);
    }
  }
}
