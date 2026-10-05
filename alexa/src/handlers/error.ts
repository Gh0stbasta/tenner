import type { ErrorHandler, HandlerInput } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { SPEECH } from "../speech.js";

/** Last line of defense: never let Alexa answer with its generic error; log without request content. */
export const GenericErrorHandler: ErrorHandler = {
  canHandle(): boolean {
    return true;
  },
  handle(input: HandlerInput, error: Error): Response {
    logEvent("error", "skill_error", {
      requestId: input.requestEnvelope.request.requestId,
      requestType: input.requestEnvelope.request.type,
      errorName: error.name,
      errorMessage: error.message,
    });
    return input.responseBuilder.speak(SPEECH.error).withShouldEndSession(true).getResponse();
  },
};
