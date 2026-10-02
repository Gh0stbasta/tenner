import { describe, expect, it } from "vitest";
import { actingUser, identityFromEvent } from "../src/auth/index.js";
import { ForbiddenError, UnauthorizedError } from "../src/exceptions/index.js";
import { authenticatedEvent, jwtClaims, TEST_IDENTITY } from "./mocks/index.js";

const event = (claims: Record<string, string> | null) => authenticatedEvent({ routeKey: "GET /tenners" }, claims);

describe("identityFromEvent", () => {
  it("derives tenant and user from the verified JWT claims", () => {
    expect(identityFromEvent(event(jwtClaims({ tenantId: "household-2", userId: "JULIA" })))).toEqual({ tenantId: "household-2", userId: "JULIA" });
  });

  it("trims claim values", () => {
    expect(identityFromEvent(event({ "custom:tenantId": " default ", "custom:userId": " STEFAN " }))).toEqual(TEST_IDENTITY);
  });

  it("rejects requests without an authorizer context with 401 (no fallback tenant)", () => {
    expect(() => identityFromEvent(event(null))).toThrow(UnauthorizedError);
  });

  it.each([
    ["missing tenant claim", { "custom:userId": "STEFAN" }],
    ["missing user claim", { "custom:tenantId": "default" }],
    ["blank tenant claim", { "custom:tenantId": " ", "custom:userId": "STEFAN" }],
    ["unknown user", { "custom:tenantId": "default", "custom:userId": "BOB" }],
    ["malformed tenant", { "custom:tenantId": "default#other", "custom:userId": "STEFAN" }],
  ])("rejects %s with 403", (_name, claims) => {
    expect(() => identityFromEvent(event(claims))).toThrow(ForbiddenError);
  });

  it("ignores identity fields outside the verified claims (headers, query, body)", () => {
    const spoofed = authenticatedEvent({
      routeKey: "GET /tenners",
      headers: { "x-tenant-id": "other" },
      queryStringParameters: { tenantId: "other" },
      body: JSON.stringify({ tenantId: "other", userId: "JULIA" }),
    });
    expect(identityFromEvent(spoofed)).toEqual(TEST_IDENTITY);
  });
});

describe("actingUser", () => {
  it("defaults to the authenticated user and accepts the same user", () => {
    expect(actingUser(TEST_IDENTITY, undefined, "revertedBy")).toBe("STEFAN");
    expect(actingUser(TEST_IDENTITY, "STEFAN", "revertedBy")).toBe("STEFAN");
  });

  it("rejects another user with 403", () => {
    expect(() => actingUser(TEST_IDENTITY, "JULIA", "restoredBy")).toThrow(ForbiddenError);
  });
});
