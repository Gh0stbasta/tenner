/** Minimal fetch mock for API tests: routes "METHOD /path" to JSON responses. */

import { vi } from "vitest";

export interface MockResponse {
  readonly status?: number;
  readonly body?: unknown;
}

export type MockHandler =
  MockResponse | ((request: { url: URL; init: RequestInit | undefined }) => MockResponse | Promise<MockResponse>);

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

/** The household members every app screen loads (HOUSEHOLD-ADMIN-001); tests can override "GET /users". */
export const DEFAULT_MEMBERS = [
  { userId: "STEFAN", displayName: "Stefan", color: "BLUE", active: true },
  { userId: "JULIA", displayName: "Julia", color: "PURPLE", active: true },
];

/** The household categories every app screen loads (HOUSEHOLD-ADMIN-002); tests can override "GET /categories". */
export const DEFAULT_CATEGORIES = [
  { categoryId: "HOUSEHOLD", name: "Haushalt", icon: "CLEANING", color: "BLUE", sortOrder: 0, archived: false },
  { categoryId: "FITNESS", name: "Fitness", icon: "FITNESS", color: "GREEN", sortOrder: 1, archived: false },
  { categoryId: "FAMILY", name: "Familie", icon: "FAMILY", color: "PINK", sortOrder: 2, archived: false },
  { categoryId: "HOME", name: "Haus & Garten", icon: "HOME", color: "ORANGE", sortOrder: 3, archived: false },
  { categoryId: "PERSONAL", name: "Persönlich", icon: "PERSON", color: "PURPLE", sortOrder: 4, archived: false },
  { categoryId: "FINANCE", name: "Finanzen", icon: "MONEY", color: "TEAL", sortOrder: 5, archived: false },
];

/** Default notification preferences (NOTIFICATION-002), no channel connected. */
export const DEFAULT_NOTIFICATION_RESPONSE = {
  preferences: {
    timezone: null,
    dailyDigest: { enabled: true, time: "07:30", channels: [] },
    overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: [] },
    weeklySummary: { enabled: false, dayOfWeek: "SUN", time: "18:00", channels: [] },
    quietHours: { start: "21:30", end: "07:00" },
  },
  channels: [
    { type: "EMAIL", connected: false },
    { type: "TELEGRAM", connected: false },
    { type: "WEB_PUSH", connected: false },
    { type: "ALEXA", connected: false },
  ],
  effectiveTimezone: "Europe/Berlin",
};

export function mockFetch(routes: Record<string, MockHandler>): FetchMock {
  const handlers: Record<string, MockHandler> = {
    "GET /users": ok(DEFAULT_MEMBERS),
    "GET /categories": ok(DEFAULT_CATEGORIES),
    "GET /users/STEFAN/notification-preferences": ok(DEFAULT_NOTIFICATION_RESPONSE),
    "GET /users/JULIA/notification-preferences": ok(DEFAULT_NOTIFICATION_RESPONSE),
    "GET /household/alexa": ok({ account: { userId: "STEFAN" }, members: DEFAULT_MEMBERS, speakers: [] }),
    ...routes,
  };
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/prod/, "");
    const handler = handlers[`${method} ${path}${url.search}`] ?? handlers[`${method} ${path}`];
    if (!handler)
      return new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "No mock" } }), {
        status: 404,
      });
    const response = typeof handler === "function" ? await handler({ url, init }) : handler;
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
