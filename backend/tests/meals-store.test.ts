/** FOOD-001: meals table keys and the versioned item store. */

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { DocumentSender } from "../src/clients/dynamodb.js";
import { ConflictError, PersistenceError } from "../src/exceptions/index.js";
import { idOfItemKey, itemKey, itemKeyPrefix, MealsStore } from "../src/meals/index.js";

type Send = Mock<DocumentSender["send"]>;
const sender = (impl?: DocumentSender["send"]): Send => vi.fn<DocumentSender["send"]>(impl);

const conditionalFailure = Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" });

describe("meal item keys", () => {
  it("builds prefixed keys and a singleton profile key", () => {
    expect(itemKey("DISH", "d-1")).toBe("DISH#d-1");
    expect(itemKey("PLAN", "2026-10-12")).toBe("PLAN#2026-10-12");
    expect(itemKey("PROFILE")).toBe("PROFILE");
    expect(itemKeyPrefix("INGREDIENT")).toBe("INGREDIENT#");
  });

  it("rejects missing IDs, IDs with the separator and IDs on the profile", () => {
    expect(() => itemKey("DISH")).toThrow();
    expect(() => itemKey("DISH", "a#b")).toThrow();
    expect(() => itemKey("PROFILE", "x")).toThrow();
  });

  it("parses the ID of a key of the same kind only", () => {
    expect(idOfItemKey("DISH", "DISH#d-1")).toBe("d-1");
    expect(idOfItemKey("DISH", "INGREDIENT#d-1")).toBeUndefined();
    expect(idOfItemKey("DISH", "DISH#")).toBeUndefined();
  });
});

describe("MealsStore", () => {
  const store = (send: Send) => new MealsStore({ send }, "tenner-meals");

  it("reads an item consistently and splits keys from data", async () => {
    const send = sender(async () => ({ Item: { tenantId: "default", itemKey: "PROFILE", version: 3, eaters: [] } }));
    await expect(store(send).get("default", "PROFILE")).resolves.toEqual({ itemKey: "PROFILE", version: 3, data: { eaters: [] } });
    const command = send.mock.calls[0]?.[0] as unknown as GetCommand;
    expect(command).toBeInstanceOf(GetCommand);
    expect(command.input).toMatchObject({ TableName: "tenner-meals", Key: { tenantId: "default", itemKey: "PROFILE" }, ConsistentRead: true });
  });

  it("returns undefined for a missing item", async () => {
    await expect(store(sender(async () => ({}))).get("default", "PROFILE")).resolves.toBeUndefined();
  });

  it("queries all pages by prefix within the tenant", async () => {
    const send = sender()
      .mockResolvedValueOnce({ Items: [{ tenantId: "default", itemKey: "DISH#a", version: 1, name: "A" }], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [{ tenantId: "default", itemKey: "DISH#b", version: 2, name: "B" }] });
    const items = await store(send).query("default", "DISH#");
    expect(items.map((item) => item.itemKey)).toEqual(["DISH#a", "DISH#b"]);
    const first = send.mock.calls[0]?.[0] as unknown as QueryCommand;
    expect(first.input.ExpressionAttributeValues).toEqual({ ":tenantId": "default", ":prefix": "DISH#" });
    expect((send.mock.calls[1]?.[0] as unknown as QueryCommand).input.ExclusiveStartKey).toEqual({ k: 1 });
  });

  it("creates new items only if absent, with version 1", async () => {
    const send = sender(async () => ({}));
    await expect(store(send).put("default", "DISH#a", { name: "A", version: 9, tenantId: "other" })).resolves.toEqual({ itemKey: "DISH#a", version: 1, data: { name: "A" } });
    const command = send.mock.calls[0]?.[0] as unknown as PutCommand;
    expect(command.input.ConditionExpression).toBe("attribute_not_exists(itemKey)");
    expect(command.input.Item).toEqual({ name: "A", tenantId: "default", itemKey: "DISH#a", version: 1 });
  });

  it("updates with the expected version and increments it", async () => {
    const send = sender(async () => ({}));
    await expect(store(send).put("default", "PROFILE", { eaters: [] }, 4)).resolves.toMatchObject({ version: 5 });
    const command = send.mock.calls[0]?.[0] as unknown as PutCommand;
    expect(command.input).toMatchObject({ ConditionExpression: "version = :expected", ExpressionAttributeValues: { ":expected": 4 } });
  });

  it("maps failed conditions to 409 and other failures to persistence errors", async () => {
    await expect(store(sender().mockRejectedValue(conditionalFailure)).put("default", "DISH#a", {})).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    await expect(store(sender().mockRejectedValue(conditionalFailure)).put("default", "PROFILE", {}, 1)).rejects.toBeInstanceOf(ConflictError);
    await expect(store(sender().mockRejectedValue(conditionalFailure)).put("default", "PROFILE", {}, 1)).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    await expect(store(sender().mockRejectedValue(new Error("boom"))).get("default", "PROFILE")).rejects.toBeInstanceOf(PersistenceError);
    await expect(store(sender().mockRejectedValue(new Error("boom"))).query("default", "DISH#")).rejects.toBeInstanceOf(PersistenceError);
    await expect(store(sender().mockRejectedValue(new Error("boom"))).put("default", "PROFILE", {})).rejects.toBeInstanceOf(PersistenceError);
  });
});
