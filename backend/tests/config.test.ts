import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses defaults when variables are missing", () => {
    expect(loadConfig({})).toEqual({ environment: "prod", logLevel: "INFO", applicationName: "Tenner" });
  });

  it("reads provided variables", () => {
    expect(loadConfig({ ENVIRONMENT: "dev", LOG_LEVEL: "debug", APPLICATION_NAME: "Tenner" })).toEqual({
      environment: "dev",
      logLevel: "DEBUG",
      applicationName: "Tenner",
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
});
