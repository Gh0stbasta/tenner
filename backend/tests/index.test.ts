import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { createDependencies, handler, route, type Dependencies } from "../src/index.js";

const config: AppConfig = {
  environment: "prod",
  logLevel: "INFO",
  applicationName: "Tenner",
  tables: { tenners: "tenner-tenners", history: "tenner-history" },
};

function event(routeKey: string): APIGatewayProxyEventV2 {
  return { routeKey, requestContext: { requestId: "req-1" } } as unknown as APIGatewayProxyEventV2;
}

function deps(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    config,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    probeDatabase: async () => true,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("route", () => {
  it("routes GET /health", async () => {
    const response = await route(event("GET /health"), deps());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "").database).toBe("connected");
  });

  it("returns 404 for unknown routes", async () => {
    const d = deps();
    const response = await route(event("POST /health"), d);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body ?? "").error.code).toBe("NOT_FOUND");
    expect(d.logger.warn).toHaveBeenCalledOnce();
  });

  it("returns 500 without internal details when a handler throws", async () => {
    const d = deps({
      probeDatabase: async () => {
        throw new Error("secret detail");
      },
    });
    const response = await route(event("GET /health"), d);
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret detail");
    expect(d.logger.error).toHaveBeenCalledOnce();
  });
});

describe("createDependencies", () => {
  it("logs the startup configuration without secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createDependencies(config);
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
