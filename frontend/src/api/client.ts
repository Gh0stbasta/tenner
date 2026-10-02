/**
 * Typed API client (FRONTEND-001). The only module that calls fetch (enforced by ESLint).
 * Every backend response uses the envelope { success: true, data } or { success: false, error }.
 * Authentication (SECURITY-003): the Cognito ID token is sent as bearer token; a 401 triggers one
 * token refresh and retry, then a redirect to the login.
 */

import { z } from "zod";
import { config } from "../config";
import { ApiError, CLIENT_ERROR_CODES } from "./errors";

export type QueryValue = string | number | boolean | undefined;

export interface RequestOptions<T> {
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  /** Zod schema for the `data` payload. Responses that do not match raise INVALID_RESPONSE. */
  readonly schema: z.ZodType<T>;
}

const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string().optional(), message: z.string() })).optional(),
  }),
});

/** Authentication hooks, registered once at startup (src/auth/userManager.ts). */
export interface ApiAuth {
  /** A valid ID token, or undefined if the user is not logged in. */
  readonly getToken: () => Promise<string | undefined>;
  /** Refresh the session; the new ID token or undefined. */
  readonly refreshToken: () => Promise<string | undefined>;
  /** Called when the API still answers 401 after a refresh (e.g. redirect to login). */
  readonly onUnauthorized: () => void;
}

let apiAuth: ApiAuth | undefined;

/** Register (or with undefined: remove) the authentication hooks. */
export function configureApiAuth(auth: ApiAuth | undefined): void {
  apiAuth = auth;
}

const successEnvelopeSchema = z.object({ success: z.literal(true), data: z.unknown() });

export function buildUrl(baseUrl: string, path: string, query: Readonly<Record<string, QueryValue>> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ""}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function send(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  token: string | undefined,
): Promise<Response> {
  try {
    return await fetch(url, {
      method,
      headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, CLIENT_ERROR_CODES.network, error instanceof Error ? error.message : "Network error.");
  }
}

async function request<T>(method: string, path: string, options: RequestOptions<T>): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new ApiError(0, CLIENT_ERROR_CODES.notConfigured, "VITE_API_BASE_URL is not configured.");
  }
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const url = buildUrl(config.apiBaseUrl, path, options.query);

  let response = await send(method, url, headers, options.body, await apiAuth?.getToken());
  if (response.status === 401 && apiAuth) {
    // Expired or revoked session: refresh once and retry; otherwise send the user to the login.
    const refreshed = await apiAuth.refreshToken();
    if (refreshed) response = await send(method, url, headers, options.body, refreshed);
    if (response.status === 401) apiAuth.onUnauthorized();
  }

  const json = await readJson(response);
  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details = [] } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText || "Request failed.");
  }

  const envelope = successEnvelopeSchema.safeParse(json);
  const data = envelope.success ? options.schema.safeParse(envelope.data.data) : undefined;
  if (!data?.success) {
    throw new ApiError(response.status, CLIENT_ERROR_CODES.invalidResponse, "Unexpected response from the API.");
  }
  return data.data;
}

export const apiClient = {
  get: <T>(path: string, options: RequestOptions<T>) => request("GET", path, options),
  post: <T>(path: string, options: RequestOptions<T>) => request("POST", path, options),
  put: <T>(path: string, options: RequestOptions<T>) => request("PUT", path, options),
  delete: <T>(path: string, options: RequestOptions<T>) => request("DELETE", path, options),
};
