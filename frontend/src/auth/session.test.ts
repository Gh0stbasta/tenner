import { describe, expect, it } from "vitest";
import { buildLogoutUrl, returnPath, userIdFromProfile } from "./session";

describe("session helpers", () => {
  it("reads the household member from the ID token claims", () => {
    expect(userIdFromProfile({ "cognito:groups": ["household:default:JULIA"] })).toBe("JULIA");
    expect(userIdFromProfile({ "cognito:groups": ["eu-central-1_X_Google", "household:default:STEFAN"] })).toBe(
      "STEFAN",
    );
    expect(userIdFromProfile({ "cognito:groups": ["household:default:BOB"] })).toBeUndefined();
    expect(
      userIdFromProfile({ "cognito:groups": ["household:default:STEFAN", "household:default:JULIA"] }),
    ).toBeUndefined();
    expect(userIdFromProfile({ "cognito:groups": ["household:default"] })).toBeUndefined();
    expect(userIdFromProfile({ "cognito:groups": "household:default:JULIA" })).toBeUndefined();
    expect(userIdFromProfile({ "custom:userId": "JULIA" })).toBeUndefined();
    expect(userIdFromProfile({})).toBeUndefined();
    expect(userIdFromProfile(undefined)).toBeUndefined();
  });

  it("builds the Cognito logout URL", () => {
    const url = buildLogoutUrl(
      { issuerUrl: "https://issuer", clientId: "abc", loginUrl: "https://login.example" },
      "https://app.example",
    );
    expect(url).toBe("https://login.example/logout?client_id=abc&logout_uri=https%3A%2F%2Fapp.example%2F");
  });

  it("returns to the current page but never to the callback", () => {
    expect(returnPath({ pathname: "/tenners/t-1", search: "?x=1" })).toBe("/tenners/t-1?x=1");
    expect(returnPath({ pathname: "/auth/callback", search: "?code=1" })).toBe("/dashboard");
  });
});
