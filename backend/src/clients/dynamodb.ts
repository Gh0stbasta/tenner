/**
 * DynamoDB client foundation (TICKET-007).
 * One shared DocumentClient per Lambda container; table names come from configuration.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, type PutCommand, type QueryCommand, type TransactWriteCommand, type UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { TableConfig } from "../config.js";

/** Probe timeout. Well below the Lambda timeout so /health answers even if DynamoDB hangs. */
export const PROBE_TIMEOUT_MS = 2000;

/** Key that never exists. Probes read it to prove access without touching real data. */
export const PROBE_KEY = { tenantId: "__healthcheck__" } as const;

/** Commands used by the application. Extend when a repository needs a new command. */
export type DocumentCommand = GetCommand | PutCommand | QueryCommand | UpdateCommand | TransactWriteCommand;

/** Minimal client interface (satisfied by DynamoDBDocumentClient), so tests can provide a fake. */
export interface DocumentSender {
  send(command: DocumentCommand, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}

let sharedClient: DynamoDBDocumentClient | undefined;

/** Lazily create the shared DocumentClient (reused across invocations). */
export function getDocumentClient(): DynamoDBDocumentClient {
  sharedClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 2 }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return sharedClient;
}

/** Sort key attribute per table, required to build a valid probe key. */
const SORT_KEYS: Record<keyof TableConfig, string> = {
  tenners: "tennerId",
  history: "historyId",
};

/**
 * Check that every configured table is reachable with the Lambda's permissions.
 * Uses a GetItem on a non-existent key: cheap, read-only, no data returned.
 * Resolves true if all tables answer within the timeout, false otherwise.
 */
export async function probeTables(
  client: DocumentSender,
  tables: TableConfig,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await Promise.all(
      (Object.keys(SORT_KEYS) as (keyof TableConfig)[]).map((table) =>
        client.send(
          new GetCommand({
            TableName: tables[table],
            Key: { ...PROBE_KEY, [SORT_KEYS[table]]: PROBE_KEY.tenantId },
          }),
          { abortSignal: controller.signal },
        ),
      ),
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
