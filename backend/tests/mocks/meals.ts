/** In-memory meals table (FOOD-001) with the store's condition semantics, for meal service tests. */

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DocumentCommand, DocumentSender } from "../../src/clients/dynamodb.js";
import { MealsStore } from "../../src/meals/index.js";

const conditionFailed = (): Error => Object.assign(new Error("The conditional request failed"), { name: "ConditionalCheckFailedException" });

export interface InMemoryMeals {
  readonly store: MealsStore;
  /** Stored items by `${tenantId}|${itemKey}`. */
  readonly items: Map<string, Record<string, unknown>>;
  readonly sender: DocumentSender;
}

export function inMemoryMeals(): InMemoryMeals {
  const items = new Map<string, Record<string, unknown>>();
  const key = (tenantId: unknown, itemKey: unknown): string => `${String(tenantId)}|${String(itemKey)}`;
  const sender: DocumentSender = {
    send: async (command: DocumentCommand) => {
      if (command instanceof GetCommand) {
        const item = items.get(key(command.input.Key?.tenantId, command.input.Key?.itemKey));
        return item ? { Item: structuredClone(item) } : {};
      }
      if (command instanceof QueryCommand) {
        const values = command.input.ExpressionAttributeValues ?? {};
        const matches = [...items.values()]
          .filter((item) => item.tenantId === values[":tenantId"] && String(item.itemKey).startsWith(String(values[":prefix"])))
          .sort((a, b) => String(a.itemKey).localeCompare(String(b.itemKey)));
        return { Items: matches.map((item) => structuredClone(item)) };
      }
      if (command instanceof PutCommand) {
        const item = command.input.Item ?? {};
        const id = key(item.tenantId, item.itemKey);
        const existing = items.get(id);
        if (command.input.ConditionExpression === "attribute_not_exists(itemKey)" && existing) throw conditionFailed();
        if (command.input.ConditionExpression === "version = :expected" && existing?.version !== command.input.ExpressionAttributeValues?.[":expected"]) throw conditionFailed();
        items.set(id, structuredClone(item));
        return {};
      }
      throw new Error(`Unsupported command ${command.constructor.name}`);
    },
  };
  return { store: new MealsStore(sender, "tenner-meals"), items, sender };
}
