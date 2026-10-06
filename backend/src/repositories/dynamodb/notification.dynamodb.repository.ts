/** Delivery log in tenner-notifications (NOTIFICATION-001): key notificationKey, TTL attribute expiresAt. */

import { GetCommand, UpdateCommand, type GetCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { DocumentSender } from "../../clients/dynamodb.js";
import { MAX_TOTAL_ATTEMPTS, type DeliveryLog, type DeliveryRecord } from "../../notifications/delivery.js";
import { isConditionalCheckFailed, toPersistenceError } from "./errors.js";

export class DynamoDbDeliveryLog implements DeliveryLog {
  constructor(
    private readonly client: DocumentSender,
    private readonly tableName: string,
  ) {}

  /**
   * Claim a key: new keys, or keys whose earlier delivery FAILED and has attempts left. A key that is SENT, SKIPPED
   * or PENDING (a delivery in progress or interrupted) is never claimed again — at most once.
   */
  async claim(record: DeliveryRecord): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { notificationKey: record.notificationKey },
          UpdateExpression:
            "SET #type = :type, #channel = :channel, #userId = :userId, #status = :pending, #errorCode = :null, #createdAt = if_not_exists(#createdAt, :createdAt), #expiresAt = :expiresAt",
          ConditionExpression: "attribute_not_exists(#key) OR (#status = :failed AND #attempts < :maxAttempts)",
          ExpressionAttributeNames: {
            "#key": "notificationKey",
            "#type": "type",
            "#channel": "channel",
            "#userId": "userId",
            "#status": "status",
            "#errorCode": "errorCode",
            "#createdAt": "createdAt",
            "#expiresAt": "expiresAt",
            "#attempts": "attempts",
          },
          ExpressionAttributeValues: {
            ":type": record.type,
            ":channel": record.channel,
            ":userId": record.userId,
            ":pending": "PENDING",
            ":failed": "FAILED",
            ":null": null,
            ":createdAt": record.createdAt,
            ":expiresAt": record.expiresAt,
            ":maxAttempts": MAX_TOTAL_ATTEMPTS,
          },
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailed(error)) return false;
      throw toPersistenceError("claim notification", error);
    }
  }

  async complete(notificationKey: string, status: DeliveryRecord["status"], attempts: number, errorCode: string | null): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { notificationKey },
          UpdateExpression: "SET #status = :status, #errorCode = :errorCode ADD #attempts :attempts",
          ExpressionAttributeNames: { "#status": "status", "#errorCode": "errorCode", "#attempts": "attempts" },
          ExpressionAttributeValues: { ":status": status, ":errorCode": errorCode, ":attempts": attempts },
        }),
      );
    } catch (error) {
      throw toPersistenceError("record notification status", error);
    }
  }

  async has(notificationKey: string): Promise<boolean> {
    try {
      const result = (await this.client.send(new GetCommand({ TableName: this.tableName, Key: { notificationKey }, ProjectionExpression: "notificationKey" }))) as GetCommandOutput;
      return result.Item !== undefined;
    } catch (error) {
      throw toPersistenceError("read notification", error);
    }
  }

  /** Unconditional marker write (UpdateItem keeps the notifier role at GetItem/UpdateItem). */
  async mark(record: DeliveryRecord): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { notificationKey: record.notificationKey },
          UpdateExpression: "SET #type = :type, #channel = :channel, #userId = :userId, #status = :status, #createdAt = :createdAt, #expiresAt = :expiresAt",
          ExpressionAttributeNames: { "#type": "type", "#channel": "channel", "#userId": "userId", "#status": "status", "#createdAt": "createdAt", "#expiresAt": "expiresAt" },
          ExpressionAttributeValues: {
            ":type": record.type,
            ":channel": record.channel,
            ":userId": record.userId,
            ":status": record.status,
            ":createdAt": record.createdAt,
            ":expiresAt": record.expiresAt,
          },
        }),
      );
    } catch (error) {
      throw toPersistenceError("mark notification", error);
    }
  }
}
