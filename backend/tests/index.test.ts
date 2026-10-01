import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { handler, route } from "../src/index.js";

const config: AppConfig = { environment: "prod", logLevel: "INFO", applicationName: "Tenner" };

function event(routeKey: string): APIGatewayProxyEventV2 {
  return { routeKey, requestContext: { requestId: "req-1" } } as unknown as APIGatewayProxyEventV2;
}

afterEach(() => vi.restoreAllMocks());

describe("route", () => {
  it("returns the health payload for GET /health", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = route(event("GET /health"), config);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["content-type"]).toBe("application/json");
    expect(JSON.parse(response.body ?? "")).toEqual({ status: "ok", application: "tenner", environment: "prod" });
  });

  it("reports the configured environment", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = route(event("GET /health"), { ...config, environment: "dev" });
    expect(JSON.parse(response.body ?? "").environment).toBe("dev");
  });

  it("returns 404 for unknown routes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = route(event("POST /health"), config);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body ?? "").error.code).toBe("NOT_FOUND");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns 500 without internal details when a handler throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
    vi.doMock("../src/handlers/health.js", () => ({
      health: () => {
        throw new Error("secret detail");
      },
    }));
    const { route: failingRoute } = await import("../src/index.js");
    const response = failingRoute(event("GET /health"), config);

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret detail");
    vi.doUnmock("../src/handlers/health.js");
  });
});

describe("handler", () => {
  it("uses the environment configuration", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await handler(event("GET /health"));
    expect(response.statusCode).toBe(200);
  });
});
