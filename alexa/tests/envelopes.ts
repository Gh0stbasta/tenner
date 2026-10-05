/** Recorded-style Alexa request envelopes for handler tests (shape of real de-DE requests, IDs anonymized). */
import type { RequestEnvelope } from "ask-sdk-model";

export const SKILL_ID = "amzn1.ask.skill.00000000-0000-0000-0000-000000000000";

function envelope(request: Record<string, unknown>, applicationId = SKILL_ID): RequestEnvelope {
  return {
    version: "1.0",
    session: {
      new: request.type === "LaunchRequest",
      sessionId: "amzn1.echo-api.session.test",
      application: { applicationId },
      user: { userId: "amzn1.ask.account.TEST" },
    },
    context: {
      System: {
        application: { applicationId },
        user: { userId: "amzn1.ask.account.TEST" },
        device: { deviceId: "amzn1.ask.device.TEST", supportedInterfaces: {} },
        apiEndpoint: "https://api.eu.amazonalexa.com",
      },
    },
    request: { requestId: "amzn1.echo-api.request.test", timestamp: "2026-10-05T07:30:00Z", locale: "de-DE", ...request },
  } as unknown as RequestEnvelope;
}

export const launchRequest = (applicationId?: string): RequestEnvelope => envelope({ type: "LaunchRequest" }, applicationId);

export const intentRequest = (name: string): RequestEnvelope =>
  envelope({ type: "IntentRequest", dialogState: "COMPLETED", intent: { name, confirmationStatus: "NONE", slots: {} } });

export const sessionEndedRequest = (reason: string, error?: { type: string; message: string }): RequestEnvelope =>
  envelope({ type: "SessionEndedRequest", reason, ...(error ? { error } : {}) });

export const unknownRequest = (type: string): RequestEnvelope => envelope({ type });
