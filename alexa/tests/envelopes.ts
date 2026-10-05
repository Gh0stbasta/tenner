/** Recorded-style Alexa request envelopes for handler tests (shape of real de-DE requests, IDs anonymized). */
import type { RequestEnvelope } from "ask-sdk-model";

export const SKILL_ID = "amzn1.ask.skill.00000000-0000-0000-0000-000000000000";
export const ACCOUNT_TOKEN = "account-token";
export const PERSON_TOKEN = "person-token";
export const PERSON_ID = "amzn1.ask.person.JULIAVOICE";

export interface EnvelopeOptions {
  readonly applicationId?: string;
  /** Account link token; null = not linked. Default: linked. */
  readonly accessToken?: string | null;
  readonly person?: { readonly personId: string; readonly accessToken?: string };
  readonly session?: Record<string, unknown>;
  readonly supportedInterfaces?: Record<string, unknown>;
}

export function envelope(request: Record<string, unknown>, options: EnvelopeOptions = {}): RequestEnvelope {
  const applicationId = options.applicationId ?? SKILL_ID;
  const token = options.accessToken === undefined ? ACCOUNT_TOKEN : options.accessToken;
  const user = { userId: "amzn1.ask.account.TEST", ...(token === null ? {} : { accessToken: token }) };
  return {
    version: "1.0",
    session: {
      new: request.type === "LaunchRequest",
      sessionId: "amzn1.echo-api.session.test",
      application: { applicationId },
      user,
      attributes: options.session ?? {},
    },
    context: {
      System: {
        application: { applicationId },
        user,
        ...(options.person ? { person: options.person } : {}),
        device: { deviceId: "amzn1.ask.device.TEST", supportedInterfaces: options.supportedInterfaces ?? {} },
        apiEndpoint: "https://api.eu.amazonalexa.com",
      },
    },
    request: { requestId: "amzn1.echo-api.request.test", timestamp: "2026-10-05T07:30:00Z", locale: "de-DE", ...request },
  } as unknown as RequestEnvelope;
}

export const launchRequest = (options: EnvelopeOptions = {}): RequestEnvelope => envelope({ type: "LaunchRequest" }, options);

export interface SlotValue {
  readonly value?: string;
  /** Entity resolution ID (dynamic or static), e.g. a userId or Tenner ID. */
  readonly id?: string;
}

export const intentRequest = (name: string, slots: Record<string, SlotValue> = {}, options: EnvelopeOptions = {}): RequestEnvelope =>
  envelope(
    {
      type: "IntentRequest",
      dialogState: "COMPLETED",
      intent: {
        name,
        confirmationStatus: "NONE",
        slots: Object.fromEntries(
          Object.entries(slots).map(([slotName, slot]) => [
            slotName,
            {
              name: slotName,
              confirmationStatus: "NONE",
              ...(slot.value === undefined ? {} : { value: slot.value }),
              ...(slot.id === undefined
                ? {}
                : {
                    resolutions: {
                      resolutionsPerAuthority: [
                        { authority: "amzn1.er-authority.echo-sdk.dynamic", status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { name: slot.value ?? "", id: slot.id } }] },
                      ],
                    },
                  }),
            },
          ]),
        ),
      },
    },
    options,
  );

export const sessionEndedRequest = (reason: string, error?: { type: string; message: string }): RequestEnvelope =>
  envelope({ type: "SessionEndedRequest", reason, ...(error ? { error } : {}) });

export const unknownRequest = (type: string): RequestEnvelope => envelope({ type });
