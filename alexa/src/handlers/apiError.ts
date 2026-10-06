import type { ErrorHandler, HandlerInput } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { logRequest } from "../requestLog.js";
import { NotLinkedError } from "../session.js";
import { SPEECH } from "../speech.js";
import { TennerApiError } from "../tennerApi.js";

/**
 * Account-linking and Tenner API failures as speech (ALEXA-002): not linked or 401 → link card; 403 → not in a
 * household; anything else → try again later. Logs carry kind, status and code only — never tokens.
 */
export const ApiErrorHandler: ErrorHandler = {
  canHandle(_input: HandlerInput, error: Error): boolean {
    return error instanceof NotLinkedError || error instanceof TennerApiError;
  },
  handle(input: HandlerInput, error: Error): Response {
    const requestId = input.requestEnvelope.request.requestId;
    if (error instanceof NotLinkedError) {
      logEvent("info", "link_required", { requestId });
      logRequest(input, undefined, "LINK_REQUIRED");
      return input.responseBuilder.speak(SPEECH.linkAccount).withLinkAccountCard().withShouldEndSession(true).getResponse();
    }
    const apiError = error as TennerApiError;
    logEvent(apiError.kind === "UNAVAILABLE" ? "error" : "info", "api_error", { requestId, kind: apiError.kind, status: apiError.status, code: apiError.code });
    logRequest(input, undefined, apiError.kind === "UNAUTHORIZED" ? "LINK_REQUIRED" : "ERROR");
    if (apiError.kind === "UNAUTHORIZED") {
      return input.responseBuilder.speak(SPEECH.relink).withLinkAccountCard().withShouldEndSession(true).getResponse();
    }
    const speech = apiError.kind === "FORBIDDEN" ? SPEECH.notInHousehold : SPEECH.unavailable;
    return input.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();
  },
};
