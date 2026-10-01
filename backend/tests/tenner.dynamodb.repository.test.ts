import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError } from "../src/exceptions/index.js";
import { DynamoDbTennerRepository } from "../src/repositories/index.js";
import { tennerFixture } from "./mocks/index.js";

function client(impl: (command: unknown) => Promise<unknown> = async () => ({})) {
  return { send: vi.fn(impl) };
}

function namedError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

describe("DynamoDbTennerRepository.save", () => {
  it("puts the item with a no-overwrite condition", async () => {
    const c = client();
    await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").save(tennerFixture());

    const command = c.send.mock.calls[0]?.[0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input).toEqual({
      TableName: "tenner-tenners",
      Item: tennerFixture(),
      ConditionExpression: "attribute_not_exists(tennerId)",
    });
  });

  it("maps a failed condition to ConflictError", async () => {
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject(namedError("ConditionalCheckFailedException"))), "t", "tenner-history");
    await expect(repository.save(tennerFixture())).rejects.toBeInstanceOf(ConflictError);
  });

  it("maps other failures to PersistenceError and keeps the cause", async () => {
    const cause = namedError("ProvisionedThroughputExceededException");
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject(cause)), "t", "tenner-history");
    const error = await repository.save(tennerFixture()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PersistenceError);
    expect((error as PersistenceError).cause).toBe(cause);
    expect((error as PersistenceError).message).toBe("Failed to save Tenner.");
  });

  it("maps non-Error rejections to PersistenceError", async () => {
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject("boom")), "t", "tenner-history");
    await expect(repository.save(tennerFixture())).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.list", () => {
  const item = { ...tennerFixture(), someStorageMetadata: "x" };

  it("follows pagination and maps items to domain objects", async () => {
    const pages = [{ Items: [item], LastEvaluatedKey: { tenantId: "default", tennerId: "a" } }, { Items: [item] }];
    const c = client(async () => pages.shift());
    const result = await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").list("default", { active: true });

    expect(result).toEqual([tennerFixture(), tennerFixture()]);
    const [first, second] = c.send.mock.calls.map(([command]) => (command as QueryCommand).input);
    expect(first).toMatchObject({ TableName: "tenner-tenners", KeyConditionExpression: "#tenantId = :tenantId" });
    expect(first).not.toHaveProperty("ExclusiveStartKey");
    expect(second?.ExclusiveStartKey).toEqual({ tenantId: "default", tennerId: "a" });
  });

  it("returns an empty list when nothing matches", async () => {
    const c = client(async () => ({}));
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").list("default")).resolves.toEqual([]);
  });

  it("maps a missing lastCompleted to null and non-true active to false", async () => {
    const item: Record<string, unknown> = { ...tennerFixture(), active: "yes" };
    delete item.lastCompleted;
    const c = client(async () => ({ Items: [item] }));
    const [tenner] = await new DynamoDbTennerRepository(c, "t", "tenner-history").list("default");
    expect(tenner?.lastCompleted).toBeNull();
    expect(tenner?.active).toBe(false);
  });

  it("maps failures to PersistenceError", async () => {
    const c = client(async () => Promise.reject(namedError("InternalServerError")));
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").list("default")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.update", () => {
  const changes = { title: "Vacuum Home Office", frequencyDays: 30, category: undefined, updatedAt: "2026-10-05T12:00:00Z" };

  it("sets only the provided fields on an existing item and returns the new state", async () => {
    const updated = { ...tennerFixture(), title: "Vacuum Home Office", frequencyDays: 30, updatedAt: "2026-10-05T12:00:00Z" };
    const c = client(async () => ({ Attributes: updated }));
    const result = await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").update("default", "t-1", changes);

    const command = c.send.mock.calls[0]?.[0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toEqual({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      UpdateExpression: "SET #title = :title, #frequencyDays = :frequencyDays, #updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(tennerId) AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
      ExpressionAttributeNames: { "#title": "title", "#frequencyDays": "frequencyDays", "#updatedAt": "updatedAt", "#deletedAt": "deletedAt" },
      ExpressionAttributeValues: { ":title": "Vacuum Home Office", ":frequencyDays": 30, ":updatedAt": "2026-10-05T12:00:00Z", ":null": null },
      ReturnValues: "ALL_NEW",
    });
    expect(result).toEqual(updated);
  });

  it("maps a missing or soft-deleted item to NotFoundError", async () => {
    const c = client(async () => Promise.reject(namedError("ConditionalCheckFailedException")));
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").update("default", "x", changes)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps other failures to PersistenceError", async () => {
    const c = client(async () => Promise.reject(namedError("ThrottlingException")));
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").update("default", "x", changes)).rejects.toBeInstanceOf(PersistenceError);
  });

  it("treats a response without attributes as a persistence failure", async () => {
    const c = client(async () => ({}));
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").update("default", "x", changes)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.getById", () => {
  it("reads consistently and maps the item", async () => {
    const c = client(async () => ({ Item: tennerFixture() }));
    await expect(new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").getById("default", "t-1")).resolves.toEqual(tennerFixture());
    expect((c.send.mock.calls[0]?.[0] as GetCommand).input).toEqual({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      ConsistentRead: true,
    });
  });

  it("returns undefined when missing and PersistenceError on failure", async () => {
    await expect(new DynamoDbTennerRepository(client(async () => ({})), "t", "tenner-history").getById("default", "x")).resolves.toBeUndefined();
    const failing = client(async () => Promise.reject(namedError("InternalServerError")));
    await expect(new DynamoDbTennerRepository(failing, "t", "tenner-history").getById("default", "x")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.delete (soft delete)", () => {
  const TS = "2026-10-01T18:00:00Z";
  const deleted = tennerFixture({ active: false, deletedAt: TS, updatedAt: TS });

  it("sets active=false, deletedAt and updatedAt with an UpdateItem (never DeleteItem)", async () => {
    const c = client(async () => ({ Attributes: deleted }));
    const result = await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").delete("default", "t-1", TS);

    expect(result).toEqual({ status: "DELETED", tenner: deleted });
    const command = c.send.mock.calls[0]?.[0] as UpdateCommand;
    expect(command).toBeInstanceOf(UpdateCommand);
    expect(command.input).toEqual({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      UpdateExpression: "SET #active = :false, #deletedAt = :timestamp, #updatedAt = :timestamp",
      ConditionExpression: "attribute_exists(tennerId) AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
      ExpressionAttributeNames: { "#active": "active", "#deletedAt": "deletedAt", "#updatedAt": "updatedAt" },
      ExpressionAttributeValues: { ":false": false, ":timestamp": TS, ":null": null },
      ReturnValues: "ALL_NEW",
    });
  });

  it("reports ALREADY_DELETED without changes for deleted Tenners", async () => {
    const earlier = tennerFixture({ active: false, deletedAt: "2026-09-01T00:00:00Z" });
    const responses: (() => Promise<unknown>)[] = [async () => Promise.reject(namedError("ConditionalCheckFailedException")), async () => ({ Item: earlier })];
    const c = client(async () => responses.shift()?.());
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").delete("default", "t-1", TS)).resolves.toEqual({ status: "ALREADY_DELETED", tenner: earlier });
    expect(c.send).toHaveBeenCalledTimes(2);
  });

  it("throws NotFoundError for missing Tenners", async () => {
    const responses: (() => Promise<unknown>)[] = [async () => Promise.reject(namedError("ConditionalCheckFailedException")), async () => ({})];
    const c = client(async () => responses.shift()?.());
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").delete("default", "x", TS)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws CONCURRENT_MODIFICATION if the item was restored between the two calls", async () => {
    const responses: (() => Promise<unknown>)[] = [async () => Promise.reject(namedError("ConditionalCheckFailedException")), async () => ({ Item: tennerFixture() })];
    const c = client(async () => responses.shift()?.());
    await expect(new DynamoDbTennerRepository(c, "t", "tenner-history").delete("default", "x", TS)).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION", statusCode: 409 });
  });

  it("maps other failures and empty responses to PersistenceError", async () => {
    const failing = client(async () => Promise.reject(namedError("ThrottlingException")));
    await expect(new DynamoDbTennerRepository(failing, "t", "tenner-history").delete("default", "x", TS)).rejects.toBeInstanceOf(PersistenceError);
    const empty = client(async () => ({}));
    await expect(new DynamoDbTennerRepository(empty, "t", "tenner-history").delete("default", "x", TS)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.restore", () => {
  const TS = "2026-10-02T09:00:00Z";

  it("sets active, clears deletedAt and refreshes updatedAt, locked on updatedAt; schedule untouched", async () => {
    const restoredItem = tennerFixture({ updatedAt: TS });
    const c = client(async () => ({ Attributes: restoredItem }));
    const result = await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").restore("default", "t-1", "2026-10-01T18:00:00Z", TS);

    expect(result).toEqual(restoredItem);
    const command = c.send.mock.calls[0]?.[0] as UpdateCommand;
    expect(command.input).toEqual({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      UpdateExpression: "SET #active = :true, #deletedAt = :null, #updatedAt = :timestamp",
      ConditionExpression: "attribute_exists(tennerId) AND #updatedAt = :expectedUpdatedAt",
      ExpressionAttributeNames: { "#active": "active", "#deletedAt": "deletedAt", "#updatedAt": "updatedAt" },
      ExpressionAttributeValues: { ":true": true, ":null": null, ":timestamp": TS, ":expectedUpdatedAt": "2026-10-01T18:00:00Z" },
      ReturnValues: "ALL_NEW",
    });
    expect(command.input.UpdateExpression).not.toMatch(/nextDue|lastCompleted/);
  });

  it("maps a failed lock to CONCURRENT_MODIFICATION", async () => {
    const c = client(async () => Promise.reject(namedError("ConditionalCheckFailedException")));
    await expect(new DynamoDbTennerRepository(c, "t", "h").restore("default", "t-1", "x", TS)).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION", statusCode: 409 });
  });

  it("maps other failures and empty responses to PersistenceError", async () => {
    await expect(new DynamoDbTennerRepository(client(async () => Promise.reject(namedError("ThrottlingException"))), "t", "h").restore("default", "t-1", "x", TS)).rejects.toBeInstanceOf(PersistenceError);
    await expect(new DynamoDbTennerRepository(client(async () => ({})), "t", "h").restore("default", "t-1", "x", TS)).rejects.toBeInstanceOf(PersistenceError);
  });
});
