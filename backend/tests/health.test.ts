import { describe, expect, it, vi } from "vitest";
import { health } from "../src/handlers/health.js";
import { mockLogger, testConfig } from "./mocks/index.js";

const config = testConfig();
const logger = mockLogger;

describe("health", () => {
  it("returns 200 and connected when the database is reachable", async () => {
    const response = await health(config, async () => true, logger());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({
      status: "ok",
      application: "tenner",
      environment: "prod",
      database: "connected",
    });
  });

  it("returns 503 and unreachable when the probe fails", async () => {
    const log = logger();
    const response = await health(config, async () => false, log);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "")).toMatchObject({ status: "error", database: "unreachable" });
    expect(log.error).toHaveBeenCalledWith("Health check failed", { database: "unreachable" });
  });

  it("returns 503 and misconfigured without probing when tables are missing", async () => {
    const probe = vi.fn(async () => true);
    const response = await health({ ...config, tables: undefined }, probe, logger());
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "").database).toBe("misconfigured");
    expect(probe).not.toHaveBeenCalled();
  });

  it("passes the configured table names to the probe", async () => {
    const probe = vi.fn(async () => true);
    await health(config, probe, logger());
    expect(probe).toHaveBeenCalledWith({ tenners: "tenner-tenners", history: "tenner-history" });
  });
});
