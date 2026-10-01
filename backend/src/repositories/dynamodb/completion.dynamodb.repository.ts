/** DynamoDB implementation of the completion history repository (table tenner-history). */

import { GetCommand, QueryCommand, type GetCommandOutput, type QueryCommandInput, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import type { Completion } from "../../models/index.js";
import type { CompletionRecord, CompletionRepository } from "../completion.repository.js";
import { tenantTennerId, toCompletion, toCompletionRecord } from "./completion.mapper.js";
import { toPersistenceError } from "./errors.js";

export const INDEX_TENNER_COMPLETED_AT = "tennerId-completedAt-index";

/** Condition matching completions that were not reverted. */
export const NOT_REVERTED = "(attribute_not_exists(#revertedAt) OR #revertedAt = :null)";

/** Items per page when filtering; filters apply after DynamoDB's Limit, so we page until enough matches. */
const PAGE_SIZE = 25;

/** History list queries (household-wide) follow with TICKET-020. */
export class DynamoDbCompletionRepository implements Pick<CompletionRepository, "getById" | "getLatestActiveCompletions" | "findByRevertIdempotencyKey"> {
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

  async getLatestActiveCompletions(tenantId: string, tennerId: string, limit: number): Promise<Completion[]> {
    const items = await this.queryTennerHistory(tenantId, tennerId, NOT_REVERTED, { "#revertedAt": "revertedAt" }, { ":null": null }, limit);
    return items.map(toCompletion);
  }

  async findByRevertIdempotencyKey(tenantId: string, tennerId: string, key: string): Promise<CompletionRecord | undefined> {
    const [item] = await this.queryTennerHistory(tenantId, tennerId, "#revertIdempotencyKey = :key", { "#revertIdempotencyKey": "revertIdempotencyKey" }, { ":key": key }, 1);
    return item ? toCompletionRecord(item) : undefined;
  }

  /** Query a Tenner's history newest first via the GSI, applying a filter, until `limit` matches are found. */
  private async queryTennerHistory(
    tenantId: string,
    tennerId: string,
    filterExpression: string,
    names: Record<string, string>,
    values: Record<string, unknown>,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: INDEX_TENNER_COMPLETED_AT,
      KeyConditionExpression: "#tenantTennerId = :tenantTennerId",
      FilterExpression: filterExpression,
      ExpressionAttributeNames: { "#tenantTennerId": "tenantTennerId", ...names },
      ExpressionAttributeValues: { ":tenantTennerId": tenantTennerId(tenantId, tennerId), ...values },
      ScanIndexForward: false,
      Limit: PAGE_SIZE,
    };
    const matches: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    try {
      do {
        const page = (await this.client.send(
          new QueryCommand({ ...input, ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}) }),
        )) as QueryCommandOutput;
        matches.push(...(page.Items ?? []));
        exclusiveStartKey = page.LastEvaluatedKey;
      } while (exclusiveStartKey && matches.length < limit);
    } catch (error) {
      throw toPersistenceError("load completion history", error);
    }
    return matches.slice(0, limit);
  }
}
