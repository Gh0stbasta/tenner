/** DynamoDB implementation of the completion history repository (table tenner-history). */

import { GetCommand, QueryCommand, type GetCommandOutput, type QueryCommandInput, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import type { Completion } from "../../models/index.js";
import type { CompletionRecord, CompletionRepository, HistoryKey, HistoryPage, HistoryQuery } from "../completion.repository.js";
import { tenantTennerId, toCompletion, toCompletionRecord } from "./completion.mapper.js";
import { toPersistenceError } from "./errors.js";

export const INDEX_TENNER_COMPLETED_AT = "tennerId-completedAt-index";
export const INDEX_COMPLETED_AT = "completedAt-index";

/** Condition matching completions that were not reverted. */
export const NOT_REVERTED = "(attribute_not_exists(#revertedAt) OR #revertedAt = :null)";

/** Items per page when filtering; filters apply after DynamoDB's Limit, so we page until enough matches. */
const PAGE_SIZE = 25;

/** Upper bound of a page scan when filters drop items, to bound cost and latency per request. */
const MAX_PAGES_PER_REQUEST = 20;

export class DynamoDbCompletionRepository implements CompletionRepository {
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

  async getHistory(tenantId: string, query: HistoryQuery): Promise<HistoryPage> {
    return this.queryPage(INDEX_COMPLETED_AT, "tenantId", tenantId, query, ["tenantId", "historyId", "completedAt"]);
  }

  async getByTenner(tenantId: string, tennerId: string, query: HistoryQuery): Promise<HistoryPage> {
    return this.queryPage(INDEX_TENNER_COMPLETED_AT, "tenantTennerId", tenantTennerId(tenantId, tennerId), query, ["tenantId", "historyId", "tenantTennerId", "completedAt"]);
  }

  /**
   * One history page, newest first. Filters (completedBy, reverted) are applied by DynamoDB after the
   * key condition, so we page until `limit` matches are found and return the key of the last returned item.
   */
  private async queryPage(indexName: string, partitionName: string, partitionValue: string, query: HistoryQuery, keyAttributes: readonly string[]): Promise<HistoryPage> {
    const names: Record<string, string> = { "#pk": partitionName };
    const values: Record<string, unknown> = { ":pk": partitionValue };
    let keyCondition = "#pk = :pk";
    if (query.from !== undefined || query.to !== undefined) {
      names["#completedAt"] = "completedAt";
      values[":from"] = query.from ?? "0000";
      values[":to"] = query.to ?? "9999";
      keyCondition += " AND #completedAt BETWEEN :from AND :to";
    }
    const filters: string[] = [];
    if (!query.includeReverted) {
      names["#revertedAt"] = "revertedAt";
      values[":null"] = null;
      filters.push(NOT_REVERTED);
    }
    if (query.completedBy !== undefined) {
      names["#completedBy"] = "completedBy";
      values[":completedBy"] = query.completedBy;
      filters.push("#completedBy = :completedBy");
    }

    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined = query.startKey;
    let exhausted = false;
    try {
      for (let page = 0; page < MAX_PAGES_PER_REQUEST && items.length < query.limit; page++) {
        const result = (await this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: indexName,
            KeyConditionExpression: keyCondition,
            ...(filters.length ? { FilterExpression: filters.join(" AND ") } : {}),
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ScanIndexForward: false,
            Limit: Math.max(query.limit, PAGE_SIZE),
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
          }),
        )) as QueryCommandOutput;
        items.push(...(result.Items ?? []));
        exclusiveStartKey = result.LastEvaluatedKey;
        if (!exclusiveStartKey) {
          exhausted = true;
          break;
        }
      }
    } catch (error) {
      throw toPersistenceError("load completion history", error);
    }

    const pageItems = items.slice(0, query.limit);
    const last = pageItems.at(-1);
    // More may follow if we cut the page or DynamoDB has more data.
    const hasMore = items.length > query.limit || !exhausted;
    const lastKey = hasMore ? (last ? pickKey(last, keyAttributes) : (exclusiveStartKey as HistoryKey | undefined)) : undefined;
    return { items: pageItems.map(toCompletion), ...(lastKey ? { lastKey } : {}) };
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

function pickKey(item: Record<string, unknown>, attributes: readonly string[]): HistoryKey {
  return Object.fromEntries(attributes.map((name) => [name, String(item[name])]));
}
