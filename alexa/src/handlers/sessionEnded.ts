import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response, SessionEndedRequest } from "ask-sdk-model";
import { logEvent } from "../log.js";

/** Alexa does not accept speech for SessionEndedRequest; log the reason (errors included) and return empty. */
export const SessionEndedRequestHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "SessionEndedRequest";
  },
  handle(input: HandlerInput): Response {
    const request = input.requestEnvelope.request as SessionEndedRequest;
    logEvent(request.reason === "ERROR" ? "error" : "info", "session_ended", {
      requestId: request.requestId,
      reason: request.reason,
      errorType: request.error?.type,
    });
    return input.responseBuilder.getResponse();
  },
};
