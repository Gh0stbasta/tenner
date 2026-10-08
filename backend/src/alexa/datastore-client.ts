/**
 * Alexa Data Store REST API (ALEXA-007): pushes the widget data to all devices of an Alexa user, one PUT_OBJECT
 * command per widget object (status: ALEXA-007, meals: FOOD-018) in a single request.
 */

export const DATASTORE_SCOPE = "alexa::datastore";
export const WIDGET_NAMESPACE = "tenner";
export const WIDGET_KEY = "status";
/** Meal widget object (FOOD-018). */
export const MEALS_KEY = "meals";
const TIMEOUT_MS = 5000;

export type PushOutcome = { readonly ok: true } | { readonly ok: false; readonly status: number | undefined; readonly userGone: boolean };

export interface DataStoreObject {
  readonly key: string;
  readonly content: unknown;
}

export interface DataStoreClient {
  putObjects(token: string, alexaUserId: string, objects: readonly DataStoreObject[]): Promise<PushOutcome>;
}

export function createDataStoreClient(apiEndpoint: string, fetchImpl: typeof fetch): DataStoreClient {
  return {
    async putObjects(token, alexaUserId, objects) {
      let response: Response;
      try {
        response = await fetchImpl(`${apiEndpoint}/v1/datastore/commands`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            commands: objects.map(({ key, content }) => ({ type: "PUT_OBJECT", namespace: WIDGET_NAMESPACE, key, content })),
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
