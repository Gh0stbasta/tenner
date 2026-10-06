import { getIntentName, getRequestType, type HandlerInput } from "ask-sdk-core";

/** True when the request is an IntentRequest for one of the given intent names. */
export function isIntent(input: HandlerInput, ...names: readonly string[]): boolean {
  return getRequestType(input.requestEnvelope) === "IntentRequest" && names.includes(getIntentName(input.requestEnvelope));
}
