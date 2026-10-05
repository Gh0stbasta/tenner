import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SPEECH } from "../speech.js";
import { isIntent } from "./intentRequest.js";

/** Stop, Cancel and NavigateHome end the session with a short goodbye. */
export const StopIntentHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return isIntent(input, "AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent");
  },
  handle(input: HandlerInput): Response {
    return input.responseBuilder.speak(SPEECH.goodbye).withShouldEndSession(true).getResponse();
  },
};
