import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SPEECH } from "../speech.js";

/** „Alexa, öffne Tenner“: spoken welcome, session stays open for a question. */
export const LaunchRequestHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "LaunchRequest";
  },
  handle(input: HandlerInput): Response {
    return input.responseBuilder.speak(SPEECH.welcome).reprompt(SPEECH.welcomeReprompt).getResponse();
  },
};
