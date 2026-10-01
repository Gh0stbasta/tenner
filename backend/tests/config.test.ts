import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const TABLES = { TENNERS_TABLE: "tenner-tenners", HISTORY_TABLE: "tenner-history" };

describe("loadConfig", () => {
  it("uses defaults when variables are missing", () => {
    expect(loadConfig({})).toEqual({
      environment: "prod",
      tenantId: "default",
      logLevel: "INFO",
      applicationName: "Tenner",
      tables: undefined,
    });
  });

  it("reads provided variables", () => {
    expect(loadConfig({ ENVIRONMENT: "dev", LOG_LEVEL: "debug", APPLICATION_NAME: "Tenner", ...TABLES })).toEqual({
      environment: "dev",
      tenantId: "default",
      logLevel: "DEBUG",
      applicationName: "Tenner",
      tables: { tenners: "tenner-tenners", history: "tenner-history" },
    });
  });

  it("falls back to INFO for unknown log levels", () => {
    expect(loadConfig({ LOG_LEVEL: "verbose" }).logLevel).toBe("INFO");
  });

  it("treats blank values as missing", () => {
    expect(loadConfig({ ENVIRONMENT: "  ", APPLICATION_NAME: "" })).toMatchObject({
      environment: "prod",
      applicationName: "Tenner",
    });
  });

  it("requires both table names", () => {
    expect(loadConfig({ TENNERS_TABLE: "tenner-tenners" }).tables).toBeUndefined();
    expect(loadConfig({ TENNERS_TABLE: "tenner-tenners", HISTORY_TABLE: " " }).tables).toBeUndefined();
  });
});
