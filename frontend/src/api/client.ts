/**
 * Typed API client (FRONTEND-001). The only module that calls fetch (enforced by ESLint).
 * Every backend response uses the envelope { success: true, data } or { success: false, error }.
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

async function request<T>(method: string, path: string, options: RequestOptions<T>): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new ApiError(0, CLIENT_ERROR_CODES.notConfigured, "VITE_API_BASE_URL is not configured.");
  }
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(config.apiBaseUrl, path, options.query), {
      method,
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new ApiError(0, CLIENT_ERROR_CODES.network, error instanceof Error ? error.message : "Network error.");
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
