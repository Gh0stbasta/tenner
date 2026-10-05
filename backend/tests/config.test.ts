import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const TABLES = { TENNERS_TABLE: "tenner-tenners", HISTORY_TABLE: "tenner-history" };

describe("loadConfig", () => {
  it("uses defaults when variables are missing", () => {
    expect(loadConfig({})).toEqual({
      environment: "prod",
      logLevel: "INFO",
      applicationName: "Tenner",
      timezone: "Europe/Berlin",
      tables: undefined,
      onboarding: undefined,
    });
  });

  it("reads provided variables", () => {
    expect(loadConfig({ ENVIRONMENT: "dev", LOG_LEVEL: "debug", APPLICATION_NAME: "Tenner", ...TABLES })).toEqual({
      environment: "dev",
      logLevel: "DEBUG",
      applicationName: "Tenner",
      timezone: "Europe/Berlin",
      tables: { tenners: "tenner-tenners", history: "tenner-history" },
      onboarding: undefined,
    });
  });

  it("reads the onboarding settings only when both variables are set (HOTFIX-001)", () => {
    expect(loadConfig({ COGNITO_USER_POOL_ID: "eu-central-1_X", HOUSEHOLD_TENANT_ID: "default" }).onboarding).toEqual({ userPoolId: "eu-central-1_X", tenantId: "default" });
    expect(loadConfig({ COGNITO_USER_POOL_ID: "eu-central-1_X" }).onboarding).toBeUndefined();
  });

  it("reads a valid APPLICATION_TIMEZONE and falls back to Europe/Berlin for invalid values", () => {
    expect(loadConfig({ APPLICATION_TIMEZONE: "America/New_York" }).timezone).toBe("America/New_York");
    expect(loadConfig({ APPLICATION_TIMEZONE: "Mars/Olympus" }).timezone).toBe("Europe/Berlin");
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
