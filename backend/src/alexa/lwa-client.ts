/**
 * Login with Amazon (LWA) client-credentials tokens for the Tenner skill (ALEXA-007/008): Data Store, Proactive
 * Events and Skill Messaging. Client ID and secret come from Parameter Store (SECURITY-006); tokens are cached per
 * scope until shortly before expiry. Neither secrets nor tokens are logged or put into errors.
 */

export const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const EXPIRY_MARGIN_MS = 60_000;
const TIMEOUT_MS = 5000;

export interface LwaCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export class LwaError extends Error {
  constructor(readonly status: number | undefined) {
    super(`LWA token request failed${status === undefined ? "" : ` (${status})`}.`);
    this.name = "LwaError";
  }
}

export interface LwaTokenClient {
  token(scope: string): Promise<string>;
}

export interface LwaOptions {
  readonly credentials: () => Promise<LwaCredentials>;
  readonly fetch: typeof fetch;
  readonly now?: () => number;
}

export function createLwaTokenClient({ credentials, fetch: fetchImpl, now = Date.now }: LwaOptions): LwaTokenClient {
  const cache = new Map<string, { token: string; expiresAt: number }>();
  return {
    async token(scope: string): Promise<string> {
      const cached = cache.get(scope);
      if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > now()) return cached.token;
      const { clientId, clientSecret } = await credentials();
      let response: Response;
      try {
        response = await fetchImpl(LWA_TOKEN_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope }).toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new LwaError(undefined);
      }
      if (!response.ok) throw new LwaError(response.status);
      const body = (await response.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown };
      if (typeof body.access_token !== "string") throw new LwaError(response.status);
      const lifetime = typeof body.expires_in === "number" ? body.expires_in * 1000 : 3_600_000;
      cache.set(scope, { token: body.access_token, expiresAt: now() + lifetime });
      return body.access_token;
    },
  };
}
