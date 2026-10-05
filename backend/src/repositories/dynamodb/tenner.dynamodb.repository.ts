/** DynamoDB implementation of the Tenner repository (table tenner-tenners). */

import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type BatchGetCommandOutput,
  type GetCommandOutput,
  type QueryCommandOutput,
  type UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { ConflictError, NotFoundError, PersistenceError } from "../../exceptions/index.js";
import type { SkipEvent, SnoozeEvent, Tenner, UserId } from "../../models/index.js";
import type { CompletionRecord } from "../completion.repository.js";
import type { SoftDeleteResult, TennerCriteria, TennerRepository, TennerUpdate } from "../tenner.repository.js";
import { toCompletionItem, toSkipItem, toSnoozeItem } from "./completion.mapper.js";
import { isConditionalCheckFailed, toConflictOrPersistenceError, toNotFoundOrPersistenceError, toPersistenceError } from "./errors.js";
import { toTenner } from "./tenner.mapper.js";
import { buildTennerQuery, NOT_DELETED } from "./tenner.query.js";

/**
 * DynamoDB Tenner repository. Deletes are soft deletes only; DeleteItem is never used (TICKET-012).
 */
export class DynamoDbTennerRepository implements TennerRepository {
  /** @param historyTableName tenner-history, written together with Tenners in completion transactions. */
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
    private readonly historyTableName: string,
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

  /** One Query on nextDue-index (nextDue <= endDate) filtered to active, non-deleted Tenners. */
  async getDashboardCandidates(tenantId: string, endDate: string): Promise<Tenner[]> {
    return this.list(tenantId, { nextDueOnOrBefore: endDate, active: true });
  }

  /** Query all matching Tenners of a tenant, following pagination. */
  async list(tenantId: string, criteria: TennerCriteria = {}): Promise<Tenner[]> {
    const input = buildTennerQuery(this.tableName, tenantId, criteria);
    const tenners: Tenner[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    try {
      do {
        const page = (await this.client.send(
          new QueryCommand({ ...input, ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}) }),
        )) as QueryCommandOutput;
        for (const item of page.Items ?? []) tenners.push(toTenner(item));
        exclusiveStartKey = page.LastEvaluatedKey;
      } while (exclusiveStartKey);
    } catch (error) {
      throw toPersistenceError("list Tenners", error);
    }
    return tenners;
  }

  /** UpdateItem with SET for the given fields only; the item must exist. Returns the updated Tenner. */
  async update(tenantId: string, tennerId: string, changes: TennerUpdate): Promise<Tenner> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    const names = Object.fromEntries(entries.map(([key]) => [`#${key}`, key]));
    const values = Object.fromEntries(entries.map(([key, value]) => [`:${key}`, value]));
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId, tennerId },
          UpdateExpression: `SET ${entries.map(([key]) => `#${key} = :${key}`).join(", ")}`,
          // Soft-deleted Tenners are treated as not found (restore via TICKET-015).
          ConditionExpression: `attribute_exists(tennerId) AND ${NOT_DELETED}`,
          ExpressionAttributeNames: { ...names, "#deletedAt": "deletedAt" },
          ExpressionAttributeValues: { ...values, ":null": null },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      attributes = result.Attributes;
    } catch (error) {
      throw toNotFoundOrPersistenceError("update Tenner", "Tenner not found.", error);
    }
    // ALL_NEW on an existing item always returns attributes; anything else is a storage contract violation.
    if (!attributes) throw new PersistenceError("Failed to update Tenner.");
    return toTenner(attributes);
  }

  /** BatchGetItem (100 keys per request, unprocessed keys retried up to 3 times), titles only. */
  async getTitles(tenantId: string, tennerIds: readonly string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const unique = [...new Set(tennerIds)];
    try {
      for (let i = 0; i < unique.length; i += 100) {
        let keys: Record<string, unknown>[] | undefined = unique.slice(i, i + 100).map((tennerId) => ({ tenantId, tennerId }));
        for (let attempt = 0; keys?.length && attempt < 4; attempt++) {
          const result = (await this.client.send(
            new BatchGetCommand({
              RequestItems: {
                [this.tableName]: { Keys: keys, ProjectionExpression: "#tennerId, #title", ExpressionAttributeNames: { "#tennerId": "tennerId", "#title": "title" } },
              },
            }),
          )) as BatchGetCommandOutput;
          for (const item of result.Responses?.[this.tableName] ?? []) titles.set(String(item.tennerId), String(item.title));
          keys = result.UnprocessedKeys?.[this.tableName]?.Keys;
        }
        if (keys?.length) throw new Error("Unprocessed keys remained after retries.");
      }
    } catch (error) {
      throw toPersistenceError("load Tenner titles", error);
    }
    return titles;
  }

  async getById(tenantId: string, tennerId: string): Promise<Tenner | undefined> {
    try {
      const result = (await this.client.send(
        new GetCommand({ TableName: this.tableName, Key: { tenantId, tennerId }, ConsistentRead: true }),
      )) as GetCommandOutput;
      return result.Item ? toTenner(result.Item) : undefined;
    } catch (error) {
      throw toPersistenceError("load Tenner", error);
    }
  }

  async delete(tenantId: string, tennerId: string, timestamp: string, actor: UserId): Promise<SoftDeleteResult> {
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId, tennerId },
          UpdateExpression: "SET #active = :false, #deletedAt = :timestamp, #updatedAt = :timestamp, #updatedBy = :actor",
          ConditionExpression: `attribute_exists(tennerId) AND ${NOT_DELETED}`,
          ExpressionAttributeNames: { "#active": "active", "#deletedAt": "deletedAt", "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: { ":false": false, ":timestamp": timestamp, ":actor": actor, ":null": null },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      if (!result.Attributes) throw new PersistenceError("Failed to delete Tenner.");
      return { status: "DELETED", tenner: toTenner(result.Attributes) };
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      if (!isConditionalCheckFailed(error)) throw toPersistenceError("delete Tenner", error);
    }
    // Condition failed: either missing or already deleted.
    const existing = await this.getById(tenantId, tennerId);
    if (!existing) throw new NotFoundError("Tenner not found.");
    if (existing.deletedAt === null) throw new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION");
    return { status: "ALREADY_DELETED", tenner: existing };
  }

  /**
   * One TransactWriteItems: [0] put history record (must not exist), [1] update Tenner schedule
   * (must still match `expected`: updatedAt, lastCompleted, frequencyDays, active, not deleted).
   */
  async completeTenner(updated: Tenner, record: CompletionRecord, expected: Tenner): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.historyTableName,
                Item: toCompletionItem(record),
                ConditionExpression: "attribute_not_exists(historyId)",
              },
            },
            { Update: this.scheduleUpdate(updated, expected) },
          ],
        }),
      );
    } catch (error) {
      throw toTransactionError(error, "complete Tenner", [
        ["DUPLICATE_COMPLETION", "A completion with this ID already exists."],
        ["CONCURRENT_MODIFICATION", "The Tenner was modified by another request."],
      ]);
    }
  }

  /**
   * One TransactWriteItems: [0] mark the completion reverted (must exist and not be reverted yet),
   * [1] restore the Tenner schedule (must still match `expected`).
   */
  async undoCompletion(restored: Tenner, reverted: CompletionRecord, expected: Tenner): Promise<void> {
    const { completion } = reverted;
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.historyTableName,
                Key: { tenantId: completion.tenantId, historyId: completion.completionId },
                UpdateExpression:
                  "SET #revertedAt = :revertedAt, #revertedBy = :revertedBy, #revertReason = :revertReason, #revertIdempotencyKey = :revertKey, #revertRequestHash = :revertHash",
                ConditionExpression: "attribute_exists(historyId) AND (attribute_not_exists(#revertedAt) OR #revertedAt = :null)",
                ExpressionAttributeNames: {
                  "#revertedAt": "revertedAt",
                  "#revertedBy": "revertedBy",
                  "#revertReason": "revertReason",
                  "#revertIdempotencyKey": "revertIdempotencyKey",
                  "#revertRequestHash": "revertRequestHash",
                },
                ExpressionAttributeValues: {
                  ":revertedAt": completion.revertedAt,
                  ":revertedBy": completion.revertedBy,
                  ":revertReason": completion.revertReason,
                  ":revertKey": reverted.revertIdempotencyKey ?? null,
                  ":revertHash": reverted.revertRequestHash ?? null,
                  ":null": null,
                },
              },
            },
            { Update: this.scheduleUpdate(restored, expected) },
          ],
        }),
      );
    } catch (error) {
      throw toTransactionError(error, "undo completion", [
        ["CONCURRENT_MODIFICATION", "The Tenner or completion was modified by another request."],
        ["CONCURRENT_MODIFICATION", "The Tenner or completion was modified by another request."],
      ]);
    }
  }

  /**
   * One TransactWriteItems: [0] put the snooze event into tenner-history (must not exist), [1] set nextDue and
   * snoozedUntil (Tenner must still match `expected`: updatedAt, active, not deleted). SCHEDULING-003.
   */
  async snoozeTenner(updated: Tenner, event: SnoozeEvent, expected: Tenner): Promise<void> {
    await this.writeScheduleEvent(updated, toSnoozeItem(event), expected, "snooze Tenner");
  }

  /** Same transaction shape as snoozeTenner, with a SKIP event (SCHEDULING-004). */
  async skipTenner(updated: Tenner, event: SkipEvent, expected: Tenner): Promise<void> {
    await this.writeScheduleEvent(updated, toSkipItem(event), expected, "skip Tenner");
  }

  /** [0] put the audit event (must not exist), [1] set nextDue/snoozedUntil locked on updatedAt, active, not deleted. */
  private async writeScheduleEvent(updated: Tenner, eventItem: Record<string, unknown>, expected: Tenner, operation: string): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: this.historyTableName, Item: eventItem, ConditionExpression: "attribute_not_exists(historyId)" } },
            {
              Update: {
                TableName: this.tableName,
                Key: { tenantId: expected.tenantId, tennerId: expected.tennerId },
                UpdateExpression: "SET #nextDue = :nextDue, #snoozedUntil = :snoozedUntil, #updatedAt = :updatedAt, #updatedBy = :updatedBy",
                ConditionExpression: ["#updatedAt = :expectedUpdatedAt", "#active = :true", NOT_DELETED].join(" AND "),
                ExpressionAttributeNames: {
                  "#nextDue": "nextDue",
                  "#snoozedUntil": "snoozedUntil",
                  "#updatedAt": "updatedAt",
                  "#updatedBy": "updatedBy",
                  "#active": "active",
                  "#deletedAt": "deletedAt",
                },
                ExpressionAttributeValues: {
                  ":nextDue": updated.nextDue,
                  ":snoozedUntil": updated.snoozedUntil,
                  ":updatedAt": updated.updatedAt,
                  ":updatedBy": updated.updatedBy,
                  ":expectedUpdatedAt": expected.updatedAt,
                  ":true": true,
                  ":null": null,
                },
              },
            },
          ],
        }),
      );
    } catch (error) {
      throw toTransactionError(error, operation, [
        ["CONCURRENT_MODIFICATION", "The Tenner was modified by another request."],
        ["CONCURRENT_MODIFICATION", "The Tenner was modified by another request."],
      ]);
    }
  }

  async restore(tenantId: string, tennerId: string, expectedUpdatedAt: string, timestamp: string, actor: UserId): Promise<Tenner> {
    let attributes: Record<string, unknown> | undefined;
    try {
      const result = (await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { tenantId, tennerId },
          UpdateExpression: "SET #active = :true, #deletedAt = :null, #updatedAt = :timestamp, #updatedBy = :actor",
          ConditionExpression: "attribute_exists(tennerId) AND #updatedAt = :expectedUpdatedAt",
          ExpressionAttributeNames: { "#active": "active", "#deletedAt": "deletedAt", "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
          ExpressionAttributeValues: { ":true": true, ":null": null, ":timestamp": timestamp, ":actor": actor, ":expectedUpdatedAt": expectedUpdatedAt },
          ReturnValues: "ALL_NEW",
        }),
      )) as UpdateCommandOutput;
      attributes = result.Attributes;
    } catch (error) {
      throw toConflictOrPersistenceError("restore Tenner", "The Tenner was modified by another request.", error, "CONCURRENT_MODIFICATION");
    }
    if (!attributes) throw new PersistenceError("Failed to restore Tenner.");
    return toTenner(attributes);
  }

  /** Update of lastCompleted/nextDue/snoozedUntil/updatedAt/updatedBy, locked on the loaded Tenner state. */
  private scheduleUpdate(updated: Tenner, expected: Tenner) {
    const lastCompletedCondition =
      expected.lastCompleted === null ? "(attribute_not_exists(#lastCompleted) OR #lastCompleted = :null)" : "#lastCompleted = :expectedLastCompleted";
    return {
      TableName: this.tableName,
      Key: { tenantId: expected.tenantId, tennerId: expected.tennerId },
      UpdateExpression: "SET #lastCompleted = :lastCompleted, #nextDue = :nextDue, #snoozedUntil = :snoozedUntil, #updatedAt = :updatedAt, #updatedBy = :updatedBy",
      ConditionExpression: ["#updatedAt = :expectedUpdatedAt", "#frequencyDays = :expectedFrequencyDays", "#active = :true", NOT_DELETED, lastCompletedCondition].join(" AND "),
      ExpressionAttributeNames: {
        "#lastCompleted": "lastCompleted",
        "#nextDue": "nextDue",
        "#snoozedUntil": "snoozedUntil",
        "#updatedAt": "updatedAt",
        "#updatedBy": "updatedBy",
        "#frequencyDays": "frequencyDays",
        "#active": "active",
        "#deletedAt": "deletedAt",
      },
      ExpressionAttributeValues: {
        ":lastCompleted": updated.lastCompleted,
        ":nextDue": updated.nextDue,
        ":snoozedUntil": updated.snoozedUntil,
        ":updatedAt": updated.updatedAt,
        ":updatedBy": updated.updatedBy,
        ":expectedUpdatedAt": expected.updatedAt,
        ":expectedFrequencyDays": expected.frequencyDays,
        ":true": true,
        ":null": null,
        ...(expected.lastCompleted === null ? {} : { ":expectedLastCompleted": expected.lastCompleted }),
      },
    };
  }
}


/**
 * Map TransactionCanceledException to application errors. `conflicts[i]` is the [code, message] used when
 * transaction item i failed its condition.
 */
function toTransactionError(error: unknown, operation: string, conflicts: readonly (readonly [string, string])[]): ConflictError | PersistenceError {
  if (error instanceof Error && error.name === "TransactionCanceledException") {
    const reasons = (error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
    const index = reasons.findIndex((reason) => reason.Code === "ConditionalCheckFailed");
    const conflict = conflicts[index];
    if (conflict) return new ConflictError(conflict[1], conflict[0]);
  }
  return toPersistenceError(operation, error);
}
