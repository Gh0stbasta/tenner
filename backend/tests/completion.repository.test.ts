import { type BatchGetCommand, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError } from "../src/exceptions/index.js";
import { DynamoDbCompletionRepository, DynamoDbTennerRepository } from "../src/repositories/index.js";
import type { CompletionRecord } from "../src/repositories/index.js";
import { tennerFixture } from "./mocks/index.js";

function client(impl: (command: unknown) => Promise<unknown>) {
  return { send: vi.fn(impl) };
}

const record: CompletionRecord = {
  completion: {
    tenantId: "default",
    completionId: "c-1",
    tennerId: "t-1",
    completedBy: "STEFAN",
    recordedBy: "JULIA",
    completedAt: "2026-10-01T18:30:00Z",
    actualMinutes: 12,
    revertedAt: null,
    revertedBy: null,
    revertReason: null,
  },
  idempotencyKey: "k-1",
  requestHash: "h",
};
const expected = tennerFixture({ tennerId: "t-1", updatedAt: "2026-09-17T10:00:00Z" });
const updated = { ...expected, lastCompleted: "2026-10-01T18:30:00Z", nextDue: "2026-10-15", updatedAt: "2026-10-01T18:30:00Z" };

describe("DynamoDbTennerRepository.completeTenner", () => {
  it("writes history and Tenner update in one transaction with optimistic locking", async () => {
    const c = client(async () => ({}));
    await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").completeTenner(updated, record, expected);

    const command = c.send.mock.calls[0]?.[0] as TransactWriteCommand;
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const [put, update] = command.input.TransactItems ?? [];
    expect(put?.Put).toEqual({
      TableName: "tenner-history",
      Item: {
        tenantId: "default",
        historyId: "c-1",
        tennerId: "t-1",
        tenantTennerId: "default#t-1",
        completedBy: "STEFAN",
        recordedBy: "JULIA",
        completedAt: "2026-10-01T18:30:00Z",
        actualMinutes: 12,
        revertedAt: null,
        revertedBy: null,
        revertReason: null,
        idempotencyKey: "k-1",
        requestHash: "h",
      },
      ConditionExpression: "attribute_not_exists(historyId)",
    });
    expect(update?.Update).toMatchObject({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      UpdateExpression: "SET #lastCompleted = :lastCompleted, #nextDue = :nextDue, #snoozedUntil = :snoozedUntil, #updatedAt = :updatedAt, #updatedBy = :updatedBy",
      ConditionExpression:
        "#updatedAt = :expectedUpdatedAt AND #frequencyDays = :expectedFrequencyDays AND #active = :true AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null) AND (attribute_not_exists(#lastCompleted) OR #lastCompleted = :null)",
      ExpressionAttributeValues: {
        ":lastCompleted": "2026-10-01T18:30:00Z",
        ":nextDue": "2026-10-15",
        ":updatedAt": "2026-10-01T18:30:00Z",
        ":expectedUpdatedAt": "2026-09-17T10:00:00Z",
        ":expectedFrequencyDays": 14,
        ":true": true,
        ":null": null,
      },
    });
  });

  it("locks on the previous lastCompleted when one exists and omits idempotency fields without a key", async () => {
    const c = client(async () => ({}));
    const previous = { ...expected, lastCompleted: "2026-09-17T10:00:00Z" };
    await new DynamoDbTennerRepository(c, "a", "b").completeTenner(updated, { completion: record.completion }, previous);
    const [put, update] = (c.send.mock.calls[0]?.[0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(put?.Put?.Item).not.toHaveProperty("idempotencyKey");
    expect(update?.Update?.ConditionExpression).toContain("#lastCompleted = :expectedLastCompleted");
    expect(update?.Update?.ExpressionAttributeValues?.[":expectedLastCompleted"]).toBe("2026-09-17T10:00:00Z");
  });

  const cancelled = (codes: string[]) => Object.assign(new Error("cancelled"), { name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })) });

  it.each([
    [["ConditionalCheckFailed", "None"], "DUPLICATE_COMPLETION"],
    [["None", "ConditionalCheckFailed"], "CONCURRENT_MODIFICATION"],
  ])("maps cancellation reasons %j to %s", async (codes, code) => {
    const c = client(async () => Promise.reject(cancelled(codes)));
    const error = await new DynamoDbTennerRepository(c, "a", "b").completeTenner(updated, record, expected).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe(code);
  });

  it.each([
    ["other cancellation reason", cancelled(["None", "ThrottlingError"])],
    ["cancellation without reasons", Object.assign(new Error("x"), { name: "TransactionCanceledException" })],
    ["generic failure", Object.assign(new Error("x"), { name: "InternalServerError" })],
  ])("maps %s to PersistenceError", async (_name, error) => {
    const c = client(async () => Promise.reject(error));
    await expect(new DynamoDbTennerRepository(c, "a", "b").completeTenner(updated, record, expected)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbCompletionRepository.getById", () => {
  it("reads the history record by historyId and maps it", async () => {
    const item = { tenantId: "default", historyId: "c-1", tennerId: "t-1", completedBy: "STEFAN", recordedBy: "JULIA", completedAt: "2026-10-01T18:30:00Z", actualMinutes: 12, idempotencyKey: "k-1", requestHash: "h" };
    const c = client(async () => ({ Item: item }));
    await expect(new DynamoDbCompletionRepository(c, "tenner-history").getById("default", "c-1")).resolves.toEqual({
      ...record,
      revertIdempotencyKey: undefined,
      revertRequestHash: undefined,
    });
    expect((c.send.mock.calls[0]?.[0] as GetCommand).input).toEqual({ TableName: "tenner-history", Key: { tenantId: "default", historyId: "c-1" }, ConsistentRead: true });
  });

  it("maps records without idempotency metadata", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", historyId: "c-2", tennerId: "t", completedBy: "JULIA", completedAt: "x", actualMinutes: 5 } }));
    const result = await new DynamoDbCompletionRepository(c, "h").getById("default", "c-2");
    expect(result?.idempotencyKey).toBeUndefined();
    expect(result?.requestHash).toBeUndefined();
  });

  it("returns undefined when missing and PersistenceError on failure", async () => {
    await expect(new DynamoDbCompletionRepository(client(async () => ({})), "h").getById("default", "x")).resolves.toBeUndefined();
    await expect(new DynamoDbCompletionRepository(client(async () => Promise.reject(new Error("x"))), "h").getById("default", "x")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("tennerId-completedAt-index access", () => {
  const item = (id: string, completedAt: string) => ({ tenantId: "default", historyId: id, tennerId: "t-1", completedBy: "STEFAN", completedAt, actualMinutes: 10, revertedAt: null });

  it("queries the GSI newest first, filtering reverted completions, paging until enough matches", async () => {
    const pages = [{ Items: [item("c-3", "2026-10-03T00:00:00Z")], LastEvaluatedKey: { k: 1 } }, { Items: [item("c-2", "2026-10-02T00:00:00Z"), item("c-1", "2026-10-01T00:00:00Z")], LastEvaluatedKey: { k: 2 } }];
    const c = client(async () => pages.shift());
    const result = await new DynamoDbCompletionRepository(c, "tenner-history").getLatestActiveCompletions("default", "t-1", 2);

    expect(result.map((x) => x.completionId)).toEqual(["c-3", "c-2"]);
    expect(c.send).toHaveBeenCalledTimes(2);
    const input = (c.send.mock.calls[0]?.[0] as QueryCommand).input;
    expect(input).toEqual({
      TableName: "tenner-history",
      IndexName: "tennerId-completedAt-index",
      KeyConditionExpression: "#tenantTennerId = :tenantTennerId",
      FilterExpression: "(attribute_not_exists(#revertedAt) OR #revertedAt = :null)",
      ExpressionAttributeNames: { "#tenantTennerId": "tenantTennerId", "#revertedAt": "revertedAt" },
      ExpressionAttributeValues: { ":tenantTennerId": "default#t-1", ":null": null },
      ScanIndexForward: false,
      Limit: 25,
    });
    expect((c.send.mock.calls[1]?.[0] as QueryCommand).input.ExclusiveStartKey).toEqual({ k: 1 });
  });

  it("stops at the end of the index and returns fewer results", async () => {
    const c = client(async () => ({ Items: [] }));
    await expect(new DynamoDbCompletionRepository(c, "h").getLatestActiveCompletions("default", "t-1", 2)).resolves.toEqual([]);
  });

  it("finds a reverted completion by its undo idempotency key", async () => {
    const c = client(async () => ({ Items: [{ ...item("c-2", "2026-10-02T00:00:00Z"), revertedAt: "2026-10-02T01:00:00Z", revertedBy: "JULIA", revertIdempotencyKey: "u-1", revertRequestHash: "h" }] }));
    const result = await new DynamoDbCompletionRepository(c, "h").findByRevertIdempotencyKey("default", "t-1", "u-1");
    expect(result?.revertRequestHash).toBe("h");
    expect(result?.completion.revertedBy).toBe("JULIA");
    expect((c.send.mock.calls[0]?.[0] as QueryCommand).input).toMatchObject({
      FilterExpression: "#revertIdempotencyKey = :key",
      ExpressionAttributeValues: { ":tenantTennerId": "default#t-1", ":key": "u-1" },
    });
  });

  it("returns undefined when no record matches the key and maps failures", async () => {
    await expect(new DynamoDbCompletionRepository(client(async () => ({})), "h").findByRevertIdempotencyKey("default", "t-1", "u")).resolves.toBeUndefined();
    await expect(new DynamoDbCompletionRepository(client(async () => Promise.reject(new Error("x"))), "h").getLatestActiveCompletions("default", "t-1", 2)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.undoCompletion", () => {
  const reverted: CompletionRecord = {
    completion: { ...record.completion, revertedAt: "2026-10-01T19:00:00Z", revertedBy: "JULIA", revertReason: "Mistake" },
    revertIdempotencyKey: "u-1",
    revertRequestHash: "h",
  };
  const current = { ...expected, lastCompleted: "2026-10-01T18:30:00Z" };
  const restored = { ...current, lastCompleted: null, nextDue: "2026-10-01", updatedAt: "2026-10-01T19:00:00Z" };

  it("reverts the completion and restores the Tenner in one transaction", async () => {
    const c = client(async () => ({}));
    await new DynamoDbTennerRepository(c, "tenner-tenners", "tenner-history").undoCompletion(restored, reverted, current);
    const [revert, restore] = (c.send.mock.calls[0]?.[0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(revert?.Update).toMatchObject({
      TableName: "tenner-history",
      Key: { tenantId: "default", historyId: "c-1" },
      ConditionExpression: "attribute_exists(historyId) AND (attribute_not_exists(#revertedAt) OR #revertedAt = :null)",
      ExpressionAttributeValues: {
        ":revertedAt": "2026-10-01T19:00:00Z",
        ":revertedBy": "JULIA",
        ":revertReason": "Mistake",
        ":revertKey": "u-1",
        ":revertHash": "h",
        ":null": null,
      },
    });
    expect(revert?.Update?.UpdateExpression).not.toMatch(/completedAt|completedBy|actualMinutes|REMOVE/);
    expect(restore?.Update).toMatchObject({
      TableName: "tenner-tenners",
      ConditionExpression: expect.stringContaining("#lastCompleted = :expectedLastCompleted"),
      ExpressionAttributeValues: expect.objectContaining({ ":lastCompleted": null, ":nextDue": "2026-10-01", ":expectedLastCompleted": "2026-10-01T18:30:00Z" }),
    });
  });

  it("stores null idempotency fields without a key", async () => {
    const c = client(async () => ({}));
    await new DynamoDbTennerRepository(c, "a", "b").undoCompletion(restored, { completion: reverted.completion }, current);
    const [revert] = (c.send.mock.calls[0]?.[0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(revert?.Update?.ExpressionAttributeValues).toMatchObject({ ":revertKey": null, ":revertHash": null });
  });

  const cancelled = (codes: string[]) => Object.assign(new Error("c"), { name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })) });

  it.each([
    [["ConditionalCheckFailed", "None"], "completion already reverted"],
    [["None", "ConditionalCheckFailed"], "Tenner modified"],
  ])("maps %j (%s) to CONCURRENT_MODIFICATION", async (codes) => {
    const c = client(async () => Promise.reject(cancelled(codes)));
    await expect(new DynamoDbTennerRepository(c, "a", "b").undoCompletion(restored, reverted, current)).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      message: "The Tenner or completion was modified by another request.",
    });
  });

  it("maps other failures to PersistenceError", async () => {
    const c = client(async () => Promise.reject(new Error("boom")));
    await expect(new DynamoDbTennerRepository(c, "a", "b").undoCompletion(restored, reverted, current)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbCompletionRepository history pages", () => {
  const item = (id: string, at: string, extra: Record<string, unknown> = {}) => ({ tenantId: "default", historyId: id, tennerId: "t-1", tenantTennerId: "default#t-1", completedBy: "STEFAN", completedAt: at, actualMinutes: 10, revertedAt: null, ...extra });

  it("queries completedAt-index newest first with date range and filters", async () => {
    const c = client(async () => ({ Items: [item("c-1", "2026-09-15T10:00:00Z")] }));
    const page = await new DynamoDbCompletionRepository(c, "tenner-history").getHistory("default", { limit: 20, from: "2026-09-01T00:00:00Z", to: "2026-09-30T23:59:59Z", completedBy: "STEFAN" });

    expect(page).toEqual({ items: [expect.objectContaining({ completionId: "c-1" })] });
    expect((c.send.mock.calls[0]?.[0] as QueryCommand).input).toEqual({
      TableName: "tenner-history",
      IndexName: "completedAt-index",
      KeyConditionExpression: "#pk = :pk AND #completedAt BETWEEN :from AND :to",
      FilterExpression: "(attribute_not_exists(#revertedAt) OR #revertedAt = :null) AND #completedBy = :completedBy",
      ExpressionAttributeNames: { "#pk": "tenantId", "#completedAt": "completedAt", "#revertedAt": "revertedAt", "#completedBy": "completedBy" },
      ExpressionAttributeValues: { ":pk": "default", ":from": "2026-09-01T00:00:00Z", ":to": "2026-09-30T23:59:59Z", ":null": null, ":completedBy": "STEFAN" },
      ScanIndexForward: false,
      Limit: 25,
    });
  });

  it("uses open bounds for a one-sided range and no filter with includeReverted", async () => {
    const c = client(async () => ({ Items: [] }));
    await new DynamoDbCompletionRepository(c, "h").getHistory("default", { limit: 50, from: "2026-09-01T00:00:00Z", includeReverted: true });
    const input = (c.send.mock.calls[0]?.[0] as QueryCommand).input;
    expect(input.ExpressionAttributeValues).toMatchObject({ ":from": "2026-09-01T00:00:00Z", ":to": "9999" });
    expect(input).not.toHaveProperty("FilterExpression");
    expect(input.Limit).toBe(50);
  });

  it("cuts the page at the limit and returns the key of the last returned item", async () => {
    const c = client(async () => ({ Items: [item("c-3", "2026-10-03T00:00:00Z"), item("c-2", "2026-10-02T00:00:00Z"), item("c-1", "2026-10-01T00:00:00Z")], LastEvaluatedKey: { x: "y" } }));
    const page = await new DynamoDbCompletionRepository(c, "h").getHistory("default", { limit: 2, startKey: { tenantId: "default", historyId: "c-9", completedAt: "z" } });
    expect(page.items.map((i) => i.completionId)).toEqual(["c-3", "c-2"]);
    expect(page.lastKey).toEqual({ tenantId: "default", historyId: "c-2", completedAt: "2026-10-02T00:00:00Z" });
    expect((c.send.mock.calls[0]?.[0] as QueryCommand).input.ExclusiveStartKey).toEqual({ tenantId: "default", historyId: "c-9", completedAt: "z" });
  });

  it("returns no key when the index is exhausted exactly at the limit", async () => {
    const c = client(async () => ({ Items: [item("c-2", "2026-10-02T00:00:00Z"), item("c-1", "2026-10-01T00:00:00Z")] }));
    expect((await new DynamoDbCompletionRepository(c, "h").getHistory("default", { limit: 2 })).lastKey).toBeUndefined();
  });

  it("keeps paging through filtered pages and stops after the page budget", async () => {
    const c = client(async () => ({ Items: [], LastEvaluatedKey: { tenantId: "default", historyId: "c-x", completedAt: "x" } }));
    const page = await new DynamoDbCompletionRepository(c, "h").getHistory("default", { limit: 5 });
    expect(c.send).toHaveBeenCalledTimes(20);
    expect(page.items).toEqual([]);
    expect(page.lastKey).toEqual({ tenantId: "default", historyId: "c-x", completedAt: "x" });
  });

  it("queries the per-Tenner index and returns its key shape", async () => {
    const c = client(async () => ({ Items: [item("c-2", "2026-10-02T00:00:00Z"), item("c-1", "2026-10-01T00:00:00Z")], LastEvaluatedKey: { k: "v" } }));
    const page = await new DynamoDbCompletionRepository(c, "h").getByTenner("default", "t-1", { limit: 1 });
    expect((c.send.mock.calls[0]?.[0] as QueryCommand).input).toMatchObject({ IndexName: "tennerId-completedAt-index", ExpressionAttributeValues: { ":pk": "default#t-1" } });
    expect(page.lastKey).toEqual({ tenantId: "default", historyId: "c-2", tenantTennerId: "default#t-1", completedAt: "2026-10-02T00:00:00Z" });
  });

  it("maps failures to PersistenceError", async () => {
    const c = client(async () => Promise.reject(new Error("x")));
    await expect(new DynamoDbCompletionRepository(c, "h").getHistory("default", { limit: 1 })).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("DynamoDbTennerRepository.getTitles", () => {
  it("batch-reads titles in chunks of 100 and retries unprocessed keys", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `t-${i}`);
    const calls: unknown[] = [];
    const c = client(async (command) => {
      const input = (command as BatchGetCommand).input;
      calls.push(input);
      const keys = input.RequestItems?.["tenner-tenners"]?.Keys ?? [];
      if (calls.length === 1) {
        return { Responses: { "tenner-tenners": keys.slice(0, 99).map((k) => ({ tennerId: k.tennerId, title: `T ${String(k.tennerId)}` })) }, UnprocessedKeys: { "tenner-tenners": { Keys: keys.slice(99) } } };
      }
      return { Responses: { "tenner-tenners": keys.map((k) => ({ tennerId: k.tennerId, title: `T ${String(k.tennerId)}` })) } };
    });
    const titles = await new DynamoDbTennerRepository(c, "tenner-tenners", "h").getTitles("default", [...ids, "t-0"]);
    expect(titles.size).toBe(101);
    expect(titles.get("t-100")).toBe("T t-100");
    expect(calls).toHaveLength(3);
    expect((calls[0] as BatchGetCommand["input"]).RequestItems?.["tenner-tenners"]).toMatchObject({ ProjectionExpression: "#tennerId, #title" });
  });

  it("fails when keys remain unprocessed after retries", async () => {
    const c = client(async (command) => ({ UnprocessedKeys: { "tenner-tenners": { Keys: (command as BatchGetCommand).input.RequestItems?.["tenner-tenners"]?.Keys } } }));
    await expect(new DynamoDbTennerRepository(c, "tenner-tenners", "h").getTitles("default", ["t-1"])).rejects.toBeInstanceOf(PersistenceError);
    expect(c.send).toHaveBeenCalledTimes(4);
  });

  it("returns an empty map for no ids", async () => {
    const c = client(async () => ({}));
    await expect(new DynamoDbTennerRepository(c, "a", "h").getTitles("default", [])).resolves.toEqual(new Map());
    expect(c.send).not.toHaveBeenCalled();
  });
});
