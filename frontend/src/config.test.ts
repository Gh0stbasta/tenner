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

  it("reads the Cognito settings only when all are present", () => {
    const env = {
      VITE_COGNITO_ISSUER_URL: "https://cognito-idp.eu-central-1.amazonaws.com/pool/",
      VITE_COGNITO_CLIENT_ID: " client ",
      VITE_COGNITO_LOGIN_URL: "https://login.example/",
    };
    expect(readConfig(env).auth).toEqual({
      issuerUrl: "https://cognito-idp.eu-central-1.amazonaws.com/pool",
      clientId: "client",
      loginUrl: "https://login.example",
    });
    expect(readConfig({ ...env, VITE_COGNITO_CLIENT_ID: "" }).auth).toBeUndefined();
  });

  it("reads the test environment", () => {
    expect(config.apiBaseUrl).toBe("https://api.test/prod");
  });
});
