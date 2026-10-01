import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { correlationIdOf, createDependencies, handler, route, type Dependencies } from "../src/index.js";
import { toTennerResponse } from "../src/dto/index.js";
import { mockLogger, tennerFixture, testConfig } from "./mocks/index.js";

const tennerResponse = toTennerResponse(tennerFixture());
const emptyDashboard = {
  referenceDate: "2026-10-01",
  timezone: "Europe/Berlin",
  summary: { dueTodayCount: 0, overdueCount: 0, upcomingCount: 0, dueTodayMinutes: 0, overdueMinutes: 0, upcomingMinutes: 0, totalActionableCount: 0, totalActionableMinutes: 0 },
  dueToday: [],
  overdue: [],
  upcoming: [],
  byUser: {},
  byCategory: {},
};

function event(routeKey: string, headers: Record<string, string> = {}, body?: string, query?: Record<string, string>): APIGatewayProxyEventV2 {
  return { routeKey, headers, body, queryStringParameters: query, requestContext: { requestId: "req-1" } } as unknown as APIGatewayProxyEventV2;
}

function deps(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    config: testConfig(),
    logger: mockLogger(),
    probeDatabase: async () => true,
    createTenner: vi.fn(async () => tennerResponse),
    listTenners: vi.fn(async () => [tennerResponse]),
    updateTenner: vi.fn(async () => tennerResponse),
    completeTenner: vi.fn(async () => ({
      response: {
        tenner: tennerResponse,
        completion: { completionId: "c-1", tennerId: "t-1", completedBy: "STEFAN" as const, completedAt: "2026-10-01T18:30:00Z", actualMinutes: 10 },
      },
      replayed: false,
    })),
    getDashboard: vi.fn(async () => emptyDashboard),
    getTenner: vi.fn(async () => tennerResponse),
    restoreTenner: vi.fn(async () => ({ response: { tennerId: "t-1", active: true, deletedAt: null }, status: "RESTORED" as const, previousDeletedAt: "2026-10-01T18:00:00Z" })),
    undoCompletion: vi.fn(async () => ({
      response: {
        tenner: tennerResponse,
        revertedCompletion: {
          completionId: "c-1",
          completedBy: "STEFAN" as const,
          completedAt: "2026-10-01T18:30:00Z",
          actualMinutes: 10,
          revertedAt: "2026-10-01T19:00:00Z",
          revertedBy: "JULIA" as const,
          revertReason: null,
        },
      },
      restoredPrevious: false,
      replayed: false,
    })),
    deleteTenner: vi.fn(async () => ({ response: { tennerId: "t-1", deleted: true as const }, outcome: { status: "DELETED" as const, tenner: tennerFixture() } })),
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

describe("GET /tenners", () => {
  it("lists Tenners with parsed filters", async () => {
    const d = deps();
    const response = await route(event("GET /tenners", {}, undefined, { assignedTo: "JULIA", due: "true", sort: "title" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: [tennerResponse] });
    expect(d.listTenners).toHaveBeenCalledWith("default", { assignedTo: "JULIA", due: true, sort: "title" });
  });

  it("lists without query parameters", async () => {
    const d = deps();
    await route(event("GET /tenners"), d);
    expect(d.listTenners).toHaveBeenCalledWith("default", {});
  });

  it.each([{ sort: "priority" }, { assignedTo: "BOB" }, { active: "yes" }, { order: "up" }, { unknown: "1" }])("rejects %j with 400", async (query) => {
    const d = deps();
    const response = await route(event("GET /tenners", {}, undefined, query), d);
    expect(response.statusCode).toBe(400);
    expect(d.listTenners).not.toHaveBeenCalled();
  });
});

describe("PUT /tenners/{tennerId}", () => {
  const put = (id: string | undefined, payload: unknown): APIGatewayProxyEventV2 =>
    ({
      routeKey: "PUT /tenners/{tennerId}",
      headers: {},
      body: JSON.stringify(payload),
      pathParameters: id === undefined ? undefined : { tennerId: id },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("updates and returns 200", async () => {
    const d = deps();
    const response = await route(put("t-1", { frequencyDays: 30 }), d);
    expect(response.statusCode).toBe(200);
    expect(d.updateTenner).toHaveBeenCalledWith("default", "t-1", { frequencyDays: 30 });
  });

  it("returns 404 when the Tenner does not exist", async () => {
    const d = deps({ updateTenner: vi.fn().mockRejectedValue(new NotFoundError("Tenner not found.")) });
    const response = await route(put("missing", { title: "Vacuum Home Office" }), d);
    expect(response.statusCode).toBe(404);
    expect(body(response).error).toEqual({ code: "NOT_FOUND", message: "Tenner not found." });
  });

  it.each([
    ["protected field nextDue", "t-1", { nextDue: "2026-12-01" }],
    ["protected field tenantId", "t-1", { tenantId: "other" }],
    ["empty body object", "t-1", {}],
    ["invalid id", "bad id!", { title: "Valid title" }],
    ["missing id", undefined, { title: "Valid title" }],
  ])("rejects %s with 400", async (_name, id, payload) => {
    const d = deps();
    const response = await route(put(id, payload), d);
    expect(response.statusCode).toBe(400);
    expect(d.updateTenner).not.toHaveBeenCalled();
  });
});

describe("DELETE /tenners/{tennerId}", () => {
  const del = (id: string): APIGatewayProxyEventV2 =>
    ({ routeKey: "DELETE /tenners/{tennerId}", headers: {}, pathParameters: { tennerId: id }, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("soft deletes and returns 200 { tennerId, deleted: true }", async () => {
    const d = deps();
    const response = await route(del("t-1"), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { tennerId: "t-1", deleted: true } });
    expect(d.deleteTenner).toHaveBeenCalledWith("default", "t-1");
  });

  it("returns 404 for missing Tenners", async () => {
    const d = deps({ deleteTenner: vi.fn().mockRejectedValue(new NotFoundError("Tenner not found.")) });
    expect((await route(del("missing"), d)).statusCode).toBe(404);
  });

  it("rejects invalid ids", async () => {
    const d = deps();
    expect((await route(del("../etc"), d)).statusCode).toBe(400);
    expect(d.deleteTenner).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/complete", () => {
  const complete = (payload: unknown, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
    ({
      routeKey: "POST /tenners/{tennerId}/complete",
      headers,
      body: JSON.stringify(payload),
      pathParameters: { tennerId: "t-1" },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("completes and passes the idempotency key", async () => {
    const d = deps();
    const response = await route(complete({ completedBy: "STEFAN", actualMinutes: 12 }, { "idempotency-key": "abc-1" }), d);
    expect(response.statusCode).toBe(200);
    expect(d.completeTenner).toHaveBeenCalledWith("default", "t-1", { completedBy: "STEFAN", actualMinutes: 12 }, "abc-1");
  });

  it.each([
    ["TENNER_INACTIVE", new ConflictError("Inactive Tenners cannot be completed.", "TENNER_INACTIVE"), 409],
    ["CONCURRENT_MODIFICATION", new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION"), 409],
    ["NOT_FOUND", new NotFoundError("Tenner not found."), 404],
  ])("maps %s", async (code, error, status) => {
    const d = deps({ completeTenner: vi.fn().mockRejectedValue(error) });
    const response = await route(complete({ completedBy: "STEFAN" }), d);
    expect(response.statusCode).toBe(status);
    expect(body(response).error?.code).toBe(code);
  });

  it("rejects an invalid idempotency key", async () => {
    const d = deps();
    expect((await route(complete({ completedBy: "STEFAN" }, { "idempotency-key": "has space" }), d)).statusCode).toBe(400);
    expect(d.completeTenner).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/undo-completion", () => {
  const undo = (payload: unknown, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
    ({
      routeKey: "POST /tenners/{tennerId}/undo-completion",
      headers,
      body: JSON.stringify(payload),
      pathParameters: { tennerId: "t-1" },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("undoes and passes the trimmed reason and idempotency key", async () => {
    const d = deps();
    const response = await route(undo({ revertedBy: "JULIA", reason: "  Completed by mistake " }, { "idempotency-key": "u-1" }), d);
    expect(response.statusCode).toBe(200);
    expect(d.undoCompletion).toHaveBeenCalledWith("default", "t-1", { revertedBy: "JULIA", reason: "Completed by mistake" }, "u-1");
  });

  it("maps NO_COMPLETION_TO_UNDO to 409", async () => {
    const d = deps({ undoCompletion: vi.fn().mockRejectedValue(new ConflictError("No active completion is available to undo.", "NO_COMPLETION_TO_UNDO")) });
    const response = await route(undo({ revertedBy: "STEFAN" }), d);
    expect(response.statusCode).toBe(409);
    expect(body(response).error).toEqual({ code: "NO_COMPLETION_TO_UNDO", message: "No active completion is available to undo." });
  });
});

describe("POST /tenners/{tennerId}/restore", () => {
  const restore = (payload: unknown): APIGatewayProxyEventV2 =>
    ({ routeKey: "POST /tenners/{tennerId}/restore", headers: {}, body: JSON.stringify(payload), pathParameters: { tennerId: "t-1" }, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("restores and returns { tennerId, active, deletedAt }", async () => {
    const d = deps();
    const response = await route(restore({ restoredBy: "JULIA" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { tennerId: "t-1", active: true, deletedAt: null } });
    expect(d.restoreTenner).toHaveBeenCalledWith("default", "t-1");
  });

  it("requires restoredBy", async () => {
    const d = deps();
    expect((await route(restore({}), d)).statusCode).toBe(400);
    expect(d.restoreTenner).not.toHaveBeenCalled();
  });
});

describe("GET /dashboard", () => {
  it("routes with parsed filters and returns the standard contract", async () => {
    const d = deps();
    const response = await route(event("GET /dashboard", {}, undefined, { assignedTo: "STEFAN", category: "HOUSEHOLD", date: "2026-10-01" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: emptyDashboard });
    expect(d.getDashboard).toHaveBeenCalledWith("default", { assignedTo: "STEFAN", category: "HOUSEHOLD", date: "2026-10-01" });
  });

  it.each([{ assignedTo: "BOB" }, { category: "GARDEN" }, { date: "01.10.2026" }, { date: "2026-02-30" }])("rejects %j with 400 Invalid dashboard query.", async (query) => {
    const d = deps();
    const response = await route(event("GET /dashboard", {}, undefined, query), d);
    expect(response.statusCode).toBe(400);
    expect(body(response).error).toMatchObject({ code: "VALIDATION_ERROR", message: "Invalid dashboard query." });
    expect(d.getDashboard).not.toHaveBeenCalled();
  });
});

describe("GET /tenners/{tennerId}", () => {
  const get = (id: string, query?: Record<string, string>): APIGatewayProxyEventV2 =>
    ({ routeKey: "GET /tenners/{tennerId}", headers: {}, pathParameters: { tennerId: id }, queryStringParameters: query, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("returns the Tenner", async () => {
    const d = deps();
    const response = await route(get("t-1"), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: tennerResponse });
    expect(d.getTenner).toHaveBeenCalledWith("default", "t-1", { includeDeleted: undefined });
  });

  it("passes includeDeleted and validates input", async () => {
    const d = deps();
    await route(get("t-1", { includeDeleted: "true" }), d);
    expect(d.getTenner).toHaveBeenCalledWith("default", "t-1", { includeDeleted: true });
    expect((await route(get("bad id"), d)).statusCode).toBe(400);
    expect((await route(get("t-1", { includeDeleted: "yes" }), d)).statusCode).toBe(400);
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
      timezone: "Europe/Berlin",
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
