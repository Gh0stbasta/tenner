import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fail, mockFetch, ok } from "../tests/fetchMock";
import { apiClient, buildUrl, configureApiAuth, type ApiAuth } from "./client";
import { ApiError } from "./errors";

const itemSchema = z.object({ id: z.string() });

describe("buildUrl", () => {
  it("adds defined query parameters only", () => {
    expect(buildUrl("https://a/prod", "/tenners", { active: true, category: undefined, limit: 5 })).toBe(
      "https://a/prod/tenners?active=true&limit=5",
    );
  });

  it("omits the query string when there are no parameters", () => {
    expect(buildUrl("https://a/prod", "/dashboard")).toBe("https://a/prod/dashboard");
  });
});

describe("apiClient", () => {
  it("unwraps the success envelope and validates the payload", async () => {
    mockFetch({ "GET /items": ok({ id: "1" }) });
    await expect(apiClient.get("/items", { schema: itemSchema })).resolves.toEqual({ id: "1" });
  });

  it("sends JSON bodies with method and headers", async () => {
    const fetchMock = mockFetch({ "POST /items": ok({ id: "2" }, 201) });
    await apiClient.post("/items", { schema: itemSchema, body: { name: "x" }, headers: { "Idempotency-Key": "k1" } });
    const [call] = fetchMock.calls();
    expect(call?.key).toBe("POST /items");
    expect(call?.body).toEqual({ name: "x" });
    expect(call?.headers).toMatchObject({ "Content-Type": "application/json", "Idempotency-Key": "k1" });
  });

  it("supports PUT and DELETE", async () => {
    mockFetch({ "PUT /items/1": ok({ id: "1" }), "DELETE /items/1": ok({ id: "1" }) });
    await expect(apiClient.put("/items/1", { schema: itemSchema, body: {} })).resolves.toEqual({ id: "1" });
    await expect(apiClient.delete("/items/1", { schema: itemSchema })).resolves.toEqual({ id: "1" });
  });

  it("maps error envelopes to ApiError with code and details", async () => {
    mockFetch({
      "POST /items": {
        status: 400,
        body: {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid", details: [{ field: "title", message: "Too short" }] },
        },
      },
    });
    const error = await apiClient.post("/items", { schema: itemSchema, body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      details: [{ field: "title", message: "Too short" }],
    });
    expect((error as ApiError).isTransient).toBe(false);
  });

  it("maps non-envelope errors to HTTP_<status>", async () => {
    mockFetch({ "GET /items": { status: 503, body: { message: "Service Unavailable" } } });
    const error = (await apiClient.get("/items", { schema: itemSchema }).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("HTTP_503");
    expect(error.isTransient).toBe(true);
  });

  it("maps throttling to a transient error", async () => {
    mockFetch({ "GET /items": fail(429, "TOO_MANY_REQUESTS") });
    const error = (await apiClient.get("/items", { schema: itemSchema }).catch((e: unknown) => e)) as ApiError;
    expect(error.isTransient).toBe(true);
  });

  it("rejects payloads that do not match the schema", async () => {
    mockFetch({ "GET /items": ok({ wrong: true }) });
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects responses without an envelope", async () => {
    mockFetch({ "GET /items": { status: 200 } });
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects non-JSON bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("maps network failures to NETWORK_ERROR with status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const error = (await apiClient.get("/items", { schema: itemSchema }).catch((e: unknown) => e)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR", message: "Failed to fetch" });
    expect(error.isTransient).toBe(true);
  });

  it("maps non-Error rejections to NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject("offline")),
    );
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});

describe("apiClient authentication (SECURITY-003)", () => {
  afterEach(() => configureApiAuth(undefined));

  function auth(overrides: Partial<ApiAuth> = {}) {
    const hooks = {
      getToken: vi.fn(async () => "id-token"),
      refreshToken: vi.fn(async () => "fresh-token"),
      onUnauthorized: vi.fn(),
      ...overrides,
    };
    configureApiAuth(hooks);
    return hooks;
  }

  it("sends the ID token as bearer token", async () => {
    auth();
    const fetchMock = mockFetch({ "GET /items": ok({ id: "1" }) });
    await apiClient.get("/items", { schema: itemSchema });
    expect(fetchMock.calls()[0]?.headers.Authorization).toBe("Bearer id-token");
  });

  it("sends no Authorization header without a session", async () => {
    auth({ getToken: vi.fn(async () => undefined) });
    const fetchMock = mockFetch({ "GET /items": ok({ id: "1" }) });
    await apiClient.get("/items", { schema: itemSchema });
    expect(fetchMock.calls()[0]?.headers).not.toHaveProperty("Authorization");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const hooks = auth();
    let calls = 0;
    const fetchMock = mockFetch({
      "GET /items": () => (++calls === 1 ? { status: 401, body: { message: "Unauthorized" } } : ok({ id: "1" })),
    });
    await expect(apiClient.get("/items", { schema: itemSchema })).resolves.toEqual({ id: "1" });
    expect(hooks.refreshToken).toHaveBeenCalledOnce();
    expect(hooks.onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock.calls()[1]?.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("asks for a new login when the refresh fails or the retry is still 401", async () => {
    const hooks = auth({ refreshToken: vi.fn(async () => undefined) });
    mockFetch({ "GET /items": { status: 401, body: { message: "Unauthorized" } } });
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ status: 401 });
    expect(hooks.onUnauthorized).toHaveBeenCalledOnce();

    const again = auth();
    mockFetch({ "GET /items": { status: 401, body: { message: "Unauthorized" } } });
    await expect(apiClient.get("/items", { schema: itemSchema })).rejects.toMatchObject({ status: 401 });
    expect(again.refreshToken).toHaveBeenCalledOnce();
    expect(again.onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe("apiClient without configuration", () => {
  it("fails with API_NOT_CONFIGURED", async () => {
    vi.resetModules();
    vi.doMock("../config", () => ({ config: { apiBaseUrl: "" } }));
    const { apiClient: unconfigured } = await import("./client");
    await expect(unconfigured.get("/items", { schema: itemSchema })).rejects.toMatchObject({
      code: "API_NOT_CONFIGURED",
    });
    vi.doUnmock("../config");
  });
});
