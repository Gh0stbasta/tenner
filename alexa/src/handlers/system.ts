import { getRequestType, type HandlerInput, type RequestHandler, type RequestInterceptor } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";

/**
 * System messages without a spoken request (MAINT-004). Before, they had no handler, ended in the generic error
 * handler and counted as skill errors (alarm tenner-alexa-skill-error-rate when the Echo Show widget loaded). They are
 * logged with their technical details instead; no speech.
 */

const MAX_TEXT = 200;
const short = (value: unknown): string | undefined => (typeof value === "string" ? value.slice(0, MAX_TEXT) : undefined);

/** An APL document (widget or Echo Show view) failed on the device; the details show what to fix in the document. */
export const AplRuntimeErrorHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "Alexa.Presentation.APL.RuntimeError";
  },
  handle(input: HandlerInput): Response {
    const request = input.requestEnvelope.request as unknown as { requestId: string; token?: string; errors?: { type?: string; reason?: string; message?: string }[] };
    logEvent("info", "apl_runtime_error", {
      requestId: request.requestId,
      token: short(request.token),
      errors: (request.errors ?? []).slice(0, 5).map((error) => ({ type: error.type, reason: error.reason, message: short(error.message) })),
    });
    return input.responseBuilder.getResponse();
  },
};

/** The Data Store could not deliver widget data to a device (e.g. device offline); the next push repeats it. */
export const DataStoreErrorHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "Alexa.DataStore.Error";
  },
  handle(input: HandlerInput): Response {
    const request = input.requestEnvelope.request as unknown as { requestId: string; error?: { type?: string } };
    // Only the error type: the content echoes the pushed commands (household data).
    logEvent("info", "datastore_error", { requestId: request.requestId, errorType: request.error?.type ?? "unknown" });
    return input.responseBuilder.getResponse();
  },
};

/**
 * Any other request type Amazon sends that the skill does not use. It sits before the intent handlers, because several
 * of them read session attributes in canHandle, which throws for requests without a session (widget messages) — that
 * was the skill error. Intents and session ends are not caught here.
 */
export const UnknownSystemRequestHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    const type = getRequestType(input.requestEnvelope);
    return type !== "IntentRequest" && type !== "SessionEndedRequest";
  },
  handle(input: HandlerInput): Response {
    logEvent("info", "unhandled_request", { requestId: input.requestEnvelope.request.requestId, requestType: getRequestType(input.requestEnvelope) });
    return input.responseBuilder.getResponse();
  },
};

/**
 * A tap on the home-screen widget may arrive without a session; the dashboard flow keeps its state in session
 * attributes, which the SDK refuses without one. Give such touch events an empty, new session (MAINT-004).
 */
export const touchSessionInterceptor: RequestInterceptor = {
  process(input: HandlerInput): void {
    const envelope = input.requestEnvelope;
    if (envelope.session || getRequestType(envelope) !== "Alexa.Presentation.APL.UserEvent") return;
    const system = envelope.context?.System;
    (envelope as { session?: unknown }).session = {
      new: true,
      sessionId: `tenner.widget.${envelope.request.requestId}`,
      application: system?.application,
      user: system?.user,
      attributes: {},
    };
    input.attributesManager.setSessionAttributes({});
  },
};
