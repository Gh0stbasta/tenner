/**
 * Access to the meals table (FOOD-001, ADR 0007): items keyed by tenantId and itemKey, each with a `version` for
 * optimistic locking. Typed repositories of the meal features build on this store; it never deletes items.
 */

import { GetCommand, PutCommand, QueryCommand, type GetCommandOutput, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { ConflictError } from "../../exceptions/index.js";
import { isConditionalCheckFailed, toPersistenceError } from "../../repositories/dynamodb/errors.js";

/** Stored attributes of a meal item besides the keys. */
export type MealItemData = Record<string, unknown>;

export interface MealItem {
  readonly itemKey: string;
  readonly version: number;
  readonly data: MealItemData;
}

const KEY_ATTRIBUTES = new Set(["tenantId", "itemKey", "version"]);

function toMealItem(item: Record<string, unknown>): MealItem {
  const data = Object.fromEntries(Object.entries(item).filter(([key]) => !KEY_ATTRIBUTES.has(key)));
  return { itemKey: String(item.itemKey), version: typeof item.version === "number" ? item.version : 0, data };
}

export class MealsStore {
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
  ) {}

  async get(tenantId: string, itemKey: string): Promise<MealItem | undefined> {
    try {
      const output = (await this.client.send(new GetCommand({ TableName: this.tableName, Key: { tenantId, itemKey }, ConsistentRead: true }))) as GetCommandOutput;
      return output.Item ? toMealItem(output.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("read meal item", error);
    }
  }

  /** All items whose key starts with the prefix (all pages), sorted by key. */
  async query(tenantId: string, prefix: string): Promise<MealItem[]> {
    const items: MealItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    try {
      do {
        const page = (await this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: "tenantId = :tenantId AND begins_with(itemKey, :prefix)",
            ExpressionAttributeValues: { ":tenantId": tenantId, ":prefix": prefix },
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
          }),
        )) as QueryCommandOutput;
        for (const item of page.Items ?? []) items.push(toMealItem(item));
        exclusiveStartKey = page.LastEvaluatedKey;
      } while (exclusiveStartKey);
    } catch (error) {
      throw toPersistenceError("query meal items", error);
    }
    return items;
  }

  /**
   * Write an item. `expectedVersion` undefined: the item must not exist yet (version 1). Otherwise the stored version
   * must equal it; the new version is expectedVersion + 1. A mismatch is a 409 CONCURRENT_MODIFICATION.
   */
  async put(tenantId: string, itemKey: string, data: MealItemData, expectedVersion?: number): Promise<MealItem> {
    const version = (expectedVersion ?? 0) + 1;
    const clean = Object.fromEntries(Object.entries(data).filter(([key]) => !KEY_ATTRIBUTES.has(key)));
    const condition =
      expectedVersion === undefined
        ? { ConditionExpression: "attribute_not_exists(itemKey)" }
        : { ConditionExpression: "version = :expected", ExpressionAttributeValues: { ":expected": expectedVersion } };
    try {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...clean, tenantId, itemKey, version }, ...condition }));
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw expectedVersion === undefined
          ? new ConflictError("The item already exists.", "ALREADY_EXISTS")
          : new ConflictError("The item was changed in the meantime. Reload and try again.", "CONCURRENT_MODIFICATION");
      }
      throw toPersistenceError("write meal item", error);
    }
    return { itemKey, version, data: clean };
  }
}
