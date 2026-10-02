/** Minimal fetch mock for API tests: routes "METHOD /path" to JSON responses. */

import { vi } from "vitest";

export interface MockResponse {
  readonly status?: number;
  readonly body?: unknown;
}

export type MockHandler = MockResponse | ((request: { url: URL; init: RequestInit | undefined }) => MockResponse);

export const TEST_API_BASE_URL = "https://api.test/prod";

export interface FetchMock {
  readonly fn: ReturnType<typeof vi.fn>;
  /** Requests received so far as "METHOD /path?query" plus parsed JSON body. */
  readonly calls: () => { key: string; body: unknown; headers: Record<string, string> }[];
}

export function ok(data: unknown, status = 200): MockResponse {
  return { status, body: { success: true, data } };
}

export function fail(status: number, code: string, message = code): MockResponse {
  return { status, body: { success: false, error: { code, message } } };
}

export function mockFetch(handlers: Record<string, MockHandler>): FetchMock {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/prod/, "");
    const handler = handlers[`${method} ${path}${url.search}`] ?? handlers[`${method} ${path}`];
    if (!handler)
      return new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "No mock" } }), {
        status: 404,
      });
    const response = typeof handler === "function" ? handler({ url, init }) : handler;
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return {
    fn,
    calls: () =>
      fn.mock.calls.map(([input, init]) => {
        const url = new URL(String(input));
        const requestInit = init as RequestInit | undefined;
        return {
          key: `${requestInit?.method ?? "GET"} ${url.pathname.replace(/^\/prod/, "")}${url.search}`,
          body: typeof requestInit?.body === "string" ? (JSON.parse(requestInit.body) as unknown) : undefined,
          headers: (requestInit?.headers ?? {}) as Record<string, string>,
        };
      }),
  };
}
