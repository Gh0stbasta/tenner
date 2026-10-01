import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { correlationIdOf, createDependencies, handler, route, type Dependencies } from "../src/index.js";
import { toTennerResponse } from "../src/dto/index.js";
import { mockLogger, tennerFixture, testConfig } from "./mocks/index.js";

const tennerResponse = toTennerResponse(tennerFixture());

function event(routeKey: string, headers: Record<string, string> = {}, body?: string): APIGatewayProxyEventV2 {
  return { routeKey, headers, body, requestContext: { requestId: "req-1" } } as unknown as APIGatewayProxyEventV2;
}

function deps(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    config: testConfig(),
    logger: mockLogger(),
    probeDatabase: async () => true,
    createTenner: vi.fn(async () => tennerResponse),
    ...overrides,
  };
}

function body(response: { body?: string | undefined }): { success?: boolean; error?: { code: string; message: string; details?: unknown } } {
  return JSON.parse(response.body ?? "") as never;
}

afterEach(() => vi.restoreAllMocks());

describe("route", () => {
  it("routes GET /health", async () => {
    const response = await route(event("GET /health"), deps());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "").database).toBe("connected");
  });

  it("returns 404 NOT_FOUND for unknown routes and logs a warning", async () => {
    const d = deps();
    const response = await route(event("POST /health"), d);
    expect(response.statusCode).toBe(404);
    expect(body(response)).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
    expect(d.logger.warn).toHaveBeenCalledWith("Request rejected", { statusCode: 404, errorCode: "NOT_FOUND" });
  });

  it("returns 500 without internal details for unexpected errors", async () => {
    const d = deps({
      probeDatabase: async () => {
        throw new Error("secret detail");
      },
    });
    const response = await route(event("GET /health"), d);
    expect(response.statusCode).toBe(500);
    expect(body(response).error).toEqual({ code: "INTERNAL_ERROR", message: "Internal server error." });
    expect(response.body).not.toContain("secret detail");
    expect(d.logger.error).toHaveBeenCalledOnce();
  });

  it.each([
    [new ValidationError("Validation failed.", [{ field: "title", message: "Too short" }]), 400, "VALIDATION_ERROR"],
    [new ConflictError("Inactive Tenners cannot be completed.", "TENNER_INACTIVE"), 409, "TENNER_INACTIVE"],
    [new PersistenceError("A storage error occurred.", { cause: new Error("ddb down") }), 500, "PERSISTENCE_ERROR"],
  ])("maps %s to its status and code", async (error, status, code) => {
    const d = deps({
      probeDatabase: async () => {
        throw error;
      },
    });
    const response = await route(event("GET /health"), d);
    expect(response.statusCode).toBe(status);
    expect(body(response).error?.code).toBe(code);
    expect(response.body).not.toContain("ddb down");
  });

  it("returns the correlation id header and binds it to the request logger", async () => {
    const d = deps();
    const response = await route(event("GET /health", { "x-correlation-id": "abc-123" }), d);
    expect(response.headers?.["x-correlation-id"]).toBe("abc-123");
    expect(d.logger.child).toHaveBeenCalledWith({ correlationId: "abc-123", routeKey: "GET /health" });
  });
});

describe("POST /tenners", () => {
  const valid = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, assignedTo: "STEFAN" };

  it("creates a Tenner for the configured tenant and returns 201", async () => {
    const d = deps();
    const response = await route(event("POST /tenners", {}, JSON.stringify(valid)), d);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: tennerResponse });
    expect(d.createTenner).toHaveBeenCalledWith("default", valid);
  });

  it("rejects invalid input with 400 before calling the service", async () => {
    const d = deps();
    const response = await route(event("POST /tenners", {}, JSON.stringify({ ...valid, frequencyDays: 0 })), d);
    expect(response.statusCode).toBe(400);
    expect(body(response).error?.code).toBe("VALIDATION_ERROR");
    expect(d.createTenner).not.toHaveBeenCalled();
  });

  it("returns 503 when the tables are not configured", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await route(event("POST /tenners", {}, JSON.stringify(valid)), createDependencies(testConfig({ tables: undefined })));
    expect(response.statusCode).toBe(503);
    expect(body(response).error?.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("correlationIdOf", () => {
  it("falls back to the request id for missing or unsafe headers", () => {
    expect(correlationIdOf(event("GET /health"))).toBe("req-1");
    expect(correlationIdOf(event("GET /health", { "x-correlation-id": "bad value\n" }))).toBe("req-1");
  });

  it("uses 'unknown' when no request id exists", () => {
    expect(correlationIdOf({ routeKey: "GET /health" } as unknown as APIGatewayProxyEventV2)).toBe("unknown");
  });
});

describe("createDependencies", () => {
  it("logs the startup configuration without secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createDependencies(testConfig());
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toEqual({
      level: "INFO",
      message: "Tenner API starting",
      environment: "prod",
      application: "Tenner",
      tables: { tenners: "tenner-tenners", history: "tenner-history" },
    });
  });
});

describe("handler", () => {
  it("reports misconfigured when table variables are missing (no AWS call)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handler(event("GET /health"));
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "").database).toBe("misconfigured");
  });
});
