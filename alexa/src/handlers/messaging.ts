/**
 * ALEXA-008: reminders and their permission.
 * - Messaging.MessageReceived {type: "REMINDER", text}: sent by the notifier at the member's digest time; the skill
 *   creates a one-time Alexa reminder in 60 seconds with its in-request API token (only way out of session).
 * - „aktiviere Erinnerungen“: asks for the reminder permission (voice consent, AskFor).
 * Missing permission and API errors are logged without IDs; there is no session to speak in.
 */

import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response, interfaces } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { isIntent } from "./intentRequest.js";

export const REMINDERS_PERMISSION = "alexa::alerts:reminders:skill:readwrite";
export const REMINDER_OFFSET_SECONDS = 60;

interface ReminderMessage {
  readonly type?: unknown;
  readonly text?: unknown;
}

/** Reminders API call with the request's apiAccessToken (fetch injectable for tests). */
export async function createReminder(fetchImpl: typeof fetch, apiEndpoint: string, apiAccessToken: string, text: string, now: Date): Promise<number> {
  const response = await fetchImpl(`${apiEndpoint}/v1/alerts/reminders`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiAccessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      requestTime: now.toISOString(),
      trigger: { type: "SCHEDULED_RELATIVE", offsetInSeconds: REMINDER_OFFSET_SECONDS },
      alertInfo: { spokenInfo: { content: [{ locale: "de-DE", text }] } },
      pushNotification: { status: "ENABLED" },
    }),
    signal: AbortSignal.timeout(5000),
  });
  return response.status;
}

export function messageReceivedHandler(fetchImpl: typeof fetch): RequestHandler {
  return {
    canHandle: (input) => getRequestType(input.requestEnvelope) === "Messaging.MessageReceived",
    async handle(input: HandlerInput): Promise<Response> {
      const request = input.requestEnvelope.request as interfaces.messaging.MessageReceivedRequest;
      const message = request.message as ReminderMessage;
      const system = input.requestEnvelope.context?.System;
      const requestId = request.requestId;
      if (message.type !== "REMINDER" || typeof message.text !== "string" || !system?.apiAccessToken) {
        logEvent("info", "message_ignored", { requestId });
        return input.responseBuilder.getResponse();
      }
      try {
        const status = await createReminder(fetchImpl, system.apiEndpoint, system.apiAccessToken, message.text.slice(0, 250), new Date());
        logEvent(status < 300 ? "info" : "error", status === 401 || status === 403 ? "reminder_permission_missing" : "reminder_created", { requestId, status });
      } catch {
        logEvent("error", "reminder_failed", { requestId });
      }
      return input.responseBuilder.getResponse();
    },
  };
}

export const ENABLE_REMINDERS_SPEECH = "Damit ich dich an deine Aufgaben erinnern kann, brauche ich deine Erlaubnis.";

/** „aktiviere Erinnerungen“ → AskFor permission (voice consent). */
export const EnableRemindersIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "EnableRemindersIntent"),
  handle(input: HandlerInput): Response {
    return input.responseBuilder
      .speak(ENABLE_REMINDERS_SPEECH)
      .addDirective({
        type: "Connections.SendRequest",
        name: "AskFor",
        payload: { "@type": "AskForPermissionsConsentRequest", "@version": "1", permissionScope: REMINDERS_PERMISSION },
        token: "",
      })
      .getResponse();
  },
};

/** Result of the AskFor request. */
export const PermissionResponseHandler: RequestHandler = {
  canHandle: (input) =>
    getRequestType(input.requestEnvelope) === "Connections.Response" && (input.requestEnvelope.request as interfaces.connections.ConnectionsResponse).name === "AskFor",
  handle(input: HandlerInput): Response {
    const payload = (input.requestEnvelope.request as interfaces.connections.ConnectionsResponse).payload as { status?: string } | undefined;
    const granted = payload?.status === "ACCEPTED";
    return input.responseBuilder
      .speak(granted ? "Danke. Ab jetzt kann ich dich an deine Aufgaben erinnern." : "Okay, dann erinnere ich dich nicht. Du kannst das in der Alexa-App jederzeit ändern.")
      .withShouldEndSession(true)
      .getResponse();
  },
};
