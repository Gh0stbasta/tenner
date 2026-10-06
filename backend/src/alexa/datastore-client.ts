/**
 * Alexa Data Store REST API (ALEXA-007): pushes the widget data to all devices of an Alexa user. Verify the request
 * shape in the spike (ticket ALEXA-007, step 1).
 */

export const DATASTORE_SCOPE = "alexa::datastore";
export const WIDGET_NAMESPACE = "tenner";
export const WIDGET_KEY = "status";
const TIMEOUT_MS = 5000;

export type PushOutcome = { readonly ok: true } | { readonly ok: false; readonly status: number | undefined; readonly userGone: boolean };

export interface DataStoreClient {
  putWidgetData(token: string, alexaUserId: string, content: unknown): Promise<PushOutcome>;
}

export function createDataStoreClient(apiEndpoint: string, fetchImpl: typeof fetch): DataStoreClient {
  return {
    async putWidgetData(token, alexaUserId, content) {
      let response: Response;
      try {
        response = await fetchImpl(`${apiEndpoint}/v1/datastore/commands`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            commands: [{ type: "PUT_OBJECT", namespace: WIDGET_NAMESPACE, key: WIDGET_KEY, content }],
            target: { type: "USER", id: alexaUserId },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { ok: false, status: undefined, userGone: false };
      }
      if (response.ok) return { ok: true };
      // The user disabled the skill or removed the widget: stop pushing to them.
      return { ok: false, status: response.status, userGone: response.status === 404 || response.status === 410 };
    },
  };
}
