import { describe, expect, it } from "vitest";
import { config, readConfig } from "./config";

describe("readConfig", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(readConfig({ VITE_API_BASE_URL: " https://api.example.com/prod// " }).apiBaseUrl).toBe(
      "https://api.example.com/prod",
    );
  });

  it("returns an empty base URL when the variable is missing", () => {
    expect(readConfig({}).apiBaseUrl).toBe("");
  });

  it("reads the test environment", () => {
    expect(config.apiBaseUrl).toBe("https://api.test/prod");
  });
});
