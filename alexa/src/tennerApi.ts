/**
 * Typed client for the Tenner HTTP API (ALEXA-002). Every call carries the linked user's Cognito access token and
 * the Alexa request ID as correlation ID; responses use the API's { success, data } envelope.
 * Failures become TennerApiError with a kind the handlers turn into speech. Tokens are never logged.
 */

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
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly correlationId: string;
  /** Per-call timeout; the whole skill response must stay inside Alexa's 8 seconds. */
  readonly timeoutMs: number;
  readonly fetch: typeof fetch;
}

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";

export interface TennerApi {
  request<T>(method: HttpMethod, path: string, body?: unknown, headers?: Readonly<Record<string, string>>): Promise<T>;
  alexaContext(): Promise<AlexaContext>;
  linkSpeaker(personId: string, userId: string): Promise<AlexaContext>;
}

export function createTennerApi(options: ApiClientOptions): TennerApi {
  async function request<T>(method: HttpMethod, path: string, body?: unknown, headers: Readonly<Record<string, string>> = {}): Promise<T> {
    if (options.baseUrl === "") throw new TennerApiError("UNAVAILABLE", undefined, "NOT_CONFIGURED");
    let response: Response;
    try {
      response = await options.fetch(`${options.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.token}`,
          "x-correlation-id": options.correlationId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch {
      // Timeout, DNS or connection failure.
      throw new TennerApiError("UNAVAILABLE", undefined, "NETWORK");
    }
    const payload = (await response.json().catch(() => undefined)) as { data?: T; error?: { code?: string } } | undefined;
    if (!response.ok) throw new TennerApiError(kindOf(response.status), response.status, payload?.error?.code);
    if (payload === undefined || !("data" in payload)) throw new TennerApiError("UNAVAILABLE", response.status, "INVALID_RESPONSE");
    return payload.data as T;
  }

  return {
    request,
    alexaContext: () => request<AlexaContext>("GET", "/household/alexa"),
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
