import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SPEECH } from "../speech.js";
import { isIntent } from "./intentRequest.js";

export const HelpIntentHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return isIntent(input, "AMAZON.HelpIntent");
  },
  handle(input: HandlerInput): Response {
    return input.responseBuilder.speak(SPEECH.help).reprompt(SPEECH.helpReprompt).getResponse();
  },
};
