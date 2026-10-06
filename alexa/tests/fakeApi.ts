/** Fake Tenner API for skill tests: routes "METHOD /path" to JSON responses and records calls. */
import { vi } from "vitest";
import type { AlexaContext } from "../src/tennerApi.js";

export interface FakeResponse {
  readonly status?: number;
  readonly data?: unknown;
  readonly error?: { readonly code: string; readonly message?: string };
}

export type FakeRoute = FakeResponse | ((body: unknown, url: string) => FakeResponse) | "never" | "network-error";

export const CONTEXT: AlexaContext = {
  account: { userId: "STEFAN" },
  timezone: "Europe/Berlin",
  members: [
    { userId: "STEFAN", displayName: "Stefan" },
    { userId: "JULIA", displayName: "Julia" },
  ],
  speakers: [],
};

export function fakeApi(routes: Record<string, FakeRoute> = {}) {
  const all: Record<string, FakeRoute> = { "GET /household/alexa": { data: CONTEXT }, ...routes };
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const { pathname, search } = new URL(url);
    const path = decodeURIComponent(pathname.replace(/^\/prod/, ""));
    const method = init.method ?? "GET";
    const key = [`${method} ${path}${search}`, `${method} ${path}`].find((candidate) => candidate in all);
    const route = key === undefined ? { status: 404, error: { code: "NOT_FOUND" } } : all[key];
    if (route === "network-error") throw new TypeError("fetch failed");
    if (route === "never") {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
      });
    }
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const response = typeof route === "function" ? route(body, url) : (route as FakeResponse);
    const status = response.status ?? 200;
    const payload = status < 400 ? { success: true, data: response.data } : { success: false, error: response.error ?? { code: "ERROR", message: "x" } };
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls: fetch.mock.calls as unknown as [string, RequestInit][] };
}

export const API_BASE = "https://api.test/prod";
