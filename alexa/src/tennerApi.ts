/**
 * Typed client for the Tenner HTTP API (ALEXA-002). Every call carries the linked user's Cognito access token and
 * the Alexa request ID as correlation ID; responses use the API's { success, data } envelope.
 * Failures become TennerApiError with a kind the handlers turn into speech. Tokens are never logged.
 * Time (MAINT-001): every attempt is limited by the request's deadline; a GET without a response is retried once.
 */

import { MIN_RETRY_MS } from "./config.js";

export type ApiFailureKind = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID" | "UNAVAILABLE";

export class TennerApiError extends Error {
  constructor(
    readonly kind: ApiFailureKind,
    readonly status: number | undefined,
    readonly code: string | undefined,
  ) {
    super(`Tenner API ${kind}${status === undefined ? "" : ` (${status})`}${code === undefined ? "" : ` ${code}`}`);
    this.name = "TennerApiError";
  }
}

export interface AlexaMember {
  readonly userId: string;
  readonly displayName: string;
}

export interface AlexaSpeaker {
  readonly personId: string;
  readonly userId: string;
}

/** GET /household/alexa */
export interface AlexaContext {
  readonly account: { readonly userId: string };
  /** Household timezone (IANA), for "today". */
  readonly timezone: string;
  readonly members: readonly AlexaMember[];
  readonly speakers: readonly AlexaSpeaker[];
  /** Whether the calling Alexa account is registered for the Echo Show widget (ALEXA-007). */
  readonly alexaUserKnown?: boolean;
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly correlationId: string;
  /** Longest single attempt (MAINT-001). */
  readonly timeoutMs: number;
  /** Epoch ms by which all calls of this request must be done; each attempt gets at most the time left. */
  readonly deadline?: number;
  /** A GET without a response is retried once if at least this much time is left (default MIN_RETRY_MS). */
  readonly minRetryMs?: number;
  readonly now?: () => number;
  readonly fetch: typeof fetch;
  /** Observes every call (status 0 = network error/timeout) for the request log (ALEXA-009). */
  readonly onCall?: (status: number, durationMs: number) => void;
}

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";

export interface TennerApi {
  request<T>(method: HttpMethod, path: string, body?: unknown, headers?: Readonly<Record<string, string>>): Promise<T>;
  alexaContext(alexaUserId?: string): Promise<AlexaContext>;
  registerAlexaUser(alexaUserId: string): Promise<void>;
  linkSpeaker(personId: string, userId: string): Promise<AlexaContext>;
}

export function createTennerApi(options: ApiClientOptions): TennerApi {
  const now = options.now ?? Date.now;
  const minRetryMs = options.minRetryMs ?? MIN_RETRY_MS;
  const timeLeft = () => (options.deadline === undefined ? options.timeoutMs : options.deadline - now());

  /** One HTTP attempt; undefined when no response came (timeout, DNS or connection failure). */
  async function attempt(method: HttpMethod, path: string, body: unknown, headers: Readonly<Record<string, string>>): Promise<Response | undefined> {
    const timeout = Math.min(options.timeoutMs, timeLeft());
    const started = now();
    try {
      if (timeout <= 0) throw new Error("No time left");
      const response = await options.fetch(`${options.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.token}`,
          "x-correlation-id": options.correlationId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeout),
      });
      options.onCall?.(response.status, now() - started);
      return response;
    } catch {
      options.onCall?.(0, now() - started);
      return undefined;
    }
  }

  async function request<T>(method: HttpMethod, path: string, body?: unknown, headers: Readonly<Record<string, string>> = {}): Promise<T> {
    if (options.baseUrl === "") throw new TennerApiError("UNAVAILABLE", undefined, "NOT_CONFIGURED");
    let response = await attempt(method, path, body, headers);
    // A read without a response (cold start, dropped connection) is safe to repeat once; writes are not repeated.
    if (response === undefined && method === "GET" && timeLeft() >= minRetryMs) response = await attempt(method, path, body, headers);
    if (response === undefined) throw new TennerApiError("UNAVAILABLE", undefined, "NETWORK");
    const payload = (await response.json().catch(() => undefined)) as { data?: T; error?: { code?: string } } | undefined;
    if (!response.ok) throw new TennerApiError(kindOf(response.status), response.status, payload?.error?.code);
    if (payload === undefined || !("data" in payload)) throw new TennerApiError("UNAVAILABLE", response.status, "INVALID_RESPONSE");
    return payload.data as T;
  }

  return {
    request,
    alexaContext: (alexaUserId) => request<AlexaContext>("GET", `/household/alexa${alexaUserId === undefined ? "" : `?alexaUserId=${encodeURIComponent(alexaUserId)}`}`),
    registerAlexaUser: async (alexaUserId) => {
      await request("PUT", `/household/alexa-users/${encodeURIComponent(alexaUserId)}`);
    },
    linkSpeaker: (personId, userId) => request<AlexaContext>("PUT", `/household/alexa-speakers/${encodeURIComponent(personId)}`, { userId }),
  };
}

function kindOf(status: number): ApiFailureKind {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400 || status === 422) return "INVALID";
  return "UNAVAILABLE";
}
