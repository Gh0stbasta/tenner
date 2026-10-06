/**
 * Alexa Proactive Events (ALEXA-008): a notification (indicator on Echo devices) with a predefined schema. Tenner uses
 * AMAZON.MessageAlert.Activated with a count only — schemas allow no free text. Verify in the spike (TD-036).
 */

export const PROACTIVE_EVENTS_SCOPE = "alexa::proactive_events";
const TIMEOUT_MS = 5000;
const EXPIRY_HOURS = 23;

export type AlexaApiOutcome = { readonly ok: true } | { readonly ok: false; readonly status: number | undefined; readonly userGone: boolean };

export interface ProactiveEventsClient {
  messageAlert(token: string, alexaUserId: string, alert: { readonly referenceId: string; readonly count: number }, now: Date): Promise<AlexaApiOutcome>;
}

export async function postJson(fetchImpl: typeof fetch, url: string, token: string, body: unknown): Promise<AlexaApiOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: undefined, userGone: false };
  }
  if (response.ok) return { ok: true };
  return { ok: false, status: response.status, userGone: response.status === 404 || response.status === 410 };
}

export function createProactiveEventsClient(apiEndpoint: string, stage: "development" | "live", fetchImpl: typeof fetch): ProactiveEventsClient {
  const url = stage === "live" ? `${apiEndpoint}/v1/proactiveEvents` : `${apiEndpoint}/v1/proactiveEvents/stages/development`;
  return {
    messageAlert(token, alexaUserId, alert, now) {
      return postJson(fetchImpl, url, token, {
        timestamp: now.toISOString(),
        referenceId: alert.referenceId,
        expiryTime: new Date(now.getTime() + EXPIRY_HOURS * 3_600_000).toISOString(),
        event: {
          name: "AMAZON.MessageAlert.Activated",
          payload: {
            state: { status: "UNREAD", freshness: "NEW" },
            messageGroup: { creator: { name: "Tenner" }, count: alert.count, urgency: "URGENT" },
          },
        },
        relevantAudience: { type: "Unicast", payload: { user: alexaUserId } },
      });
    },
  };
}
