import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError } from "../src/exceptions/index.js";
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
    await new DynamoDbTennerRepository(c, "tenner-tenners").save(tennerFixture());

    const command = c.send.mock.calls[0]?.[0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input).toEqual({
      TableName: "tenner-tenners",
      Item: tennerFixture(),
      ConditionExpression: "attribute_not_exists(tennerId)",
    });
  });

  it("maps a failed condition to ConflictError", async () => {
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject(namedError("ConditionalCheckFailedException"))), "t");
    await expect(repository.save(tennerFixture())).rejects.toBeInstanceOf(ConflictError);
  });

  it("maps other failures to PersistenceError and keeps the cause", async () => {
    const cause = namedError("ProvisionedThroughputExceededException");
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject(cause)), "t");
    const error = await repository.save(tennerFixture()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PersistenceError);
    expect((error as PersistenceError).cause).toBe(cause);
    expect((error as PersistenceError).message).toBe("Failed to save Tenner.");
  });

  it("maps non-Error rejections to PersistenceError", async () => {
    const repository = new DynamoDbTennerRepository(client(async () => Promise.reject("boom")), "t");
    await expect(repository.save(tennerFixture())).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.list", () => {
  const item = { ...tennerFixture(), someStorageMetadata: "x" };

  it("follows pagination and maps items to domain objects", async () => {
    const pages = [{ Items: [item], LastEvaluatedKey: { tenantId: "default", tennerId: "a" } }, { Items: [item] }];
    const c = client(async () => pages.shift());
    const result = await new DynamoDbTennerRepository(c, "tenner-tenners").list("default", { active: true });

    expect(result).toEqual([tennerFixture(), tennerFixture()]);
    const [first, second] = c.send.mock.calls.map(([command]) => (command as QueryCommand).input);
    expect(first).toMatchObject({ TableName: "tenner-tenners", KeyConditionExpression: "#tenantId = :tenantId" });
    expect(first).not.toHaveProperty("ExclusiveStartKey");
    expect(second?.ExclusiveStartKey).toEqual({ tenantId: "default", tennerId: "a" });
  });

  it("returns an empty list when nothing matches", async () => {
    const c = client(async () => ({}));
    await expect(new DynamoDbTennerRepository(c, "t").list("default")).resolves.toEqual([]);
  });

  it("maps a missing lastCompleted to null and non-true active to false", async () => {
    const item: Record<string, unknown> = { ...tennerFixture(), active: "yes" };
    delete item.lastCompleted;
    const c = client(async () => ({ Items: [item] }));
    const [tenner] = await new DynamoDbTennerRepository(c, "t").list("default");
    expect(tenner?.lastCompleted).toBeNull();
    expect(tenner?.active).toBe(false);
  });

  it("maps failures to PersistenceError", async () => {
    const c = client(async () => Promise.reject(namedError("InternalServerError")));
    await expect(new DynamoDbTennerRepository(c, "t").list("default")).rejects.toBeInstanceOf(PersistenceError);
  });
});
