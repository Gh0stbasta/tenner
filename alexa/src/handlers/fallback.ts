import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SPEECH } from "../speech.js";

/**
 * AMAZON.FallbackIntent and every intent no other handler claims (an interaction model newer than the Lambda).
 * Registered last so specific handlers win.
 */
export const FallbackIntentHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "IntentRequest";
  },
  handle(input: HandlerInput): Response {
    return input.responseBuilder.speak(SPEECH.fallback).reprompt(SPEECH.fallbackReprompt).getResponse();
  },
};
