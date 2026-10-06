/** EventBridge client for household change events (ALEXA-007). One shared client per Lambda container. */

import { EventBridgeClient, type PutEventsCommand } from "@aws-sdk/client-eventbridge";

export interface EventSender {
  send(command: PutEventsCommand, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}

let sharedClient: EventBridgeClient | undefined;

export function getEventBridgeClient(): EventBridgeClient {
  sharedClient ??= new EventBridgeClient({ maxAttempts: 1 });
  return sharedClient;
}
