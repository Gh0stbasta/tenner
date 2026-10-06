/**
 * "Household changed" events (ALEXA-007): after every successful write the API puts a small event on EventBridge;
 * a rule invokes the notifier, which refreshes the Echo Show widget. Publishing never fails the API request: errors
 * are logged and the next change or the day-start push repairs the widget.
 */

import { PutEventsCommand, type PutEventsCommandOutput } from "@aws-sdk/client-eventbridge";
import type { EventSender } from "../clients/eventbridge.js";
import type { Logger } from "../utils/logger.js";

export const HOUSEHOLD_EVENT_SOURCE = "tenner.api";
export const HOUSEHOLD_CHANGED = "HouseholdChanged";
const PUBLISH_TIMEOUT_MS = 1000;

export type HouseholdChangePublisher = (tenantId: string, routeKey: string, logger: Logger) => Promise<void>;

export function createHouseholdChangePublisher(client: EventSender, busName: string): HouseholdChangePublisher {
  return async (tenantId, routeKey, logger) => {
    try {
      const result = (await client.send(
        new PutEventsCommand({ Entries: [{ Source: HOUSEHOLD_EVENT_SOURCE, DetailType: HOUSEHOLD_CHANGED, EventBusName: busName, Detail: JSON.stringify({ tenantId, routeKey }) }] }),
        { abortSignal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS) },
      )) as PutEventsCommandOutput;
      if ((result.FailedEntryCount ?? 0) > 0) logger.warn("Household change event rejected", { event: "HouseholdEventFailed", errorCode: result.Entries?.[0]?.ErrorCode });
    } catch (error) {
      logger.warn("Household change event not published", { event: "HouseholdEventFailed", error: error instanceof Error ? error.name : "UnknownError" });
    }
  };
}

/** Writes that change what the widget shows: every successful non-GET request on a protected route. */
export const changesHousehold = (routeKey: string, statusCode: number): boolean => !routeKey.startsWith("GET ") && statusCode >= 200 && statusCode < 300;
