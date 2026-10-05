import { describe, expect, it } from "vitest";
import { actingUser, groupsOf, identityFromEvent } from "../src/auth/index.js";
import { ForbiddenError, UnauthorizedError } from "../src/exceptions/index.js";
import { authenticatedEvent, jwtClaims, TEST_IDENTITY } from "./mocks/index.js";

const event = (claims: Record<string, string> | null) => authenticatedEvent({ routeKey: "GET /tenners" }, claims);
const withGroups = (groups: string) => event({ sub: "x", "cognito:groups": groups });

describe("identityFromEvent", () => {
  it("derives tenant and user from the household group in the verified claims", () => {
    expect(identityFromEvent(event(jwtClaims({ tenantId: "household-2", userId: "JULIA" })))).toEqual({ tenantId: "household-2", userId: "JULIA" });
  });

  it("ignores groups that are not household groups", () => {
    expect(identityFromEvent(withGroups("[eu-central-1_TEST_Google household:default:STEFAN admins]"))).toEqual(TEST_IDENTITY);
  });

  it("rejects requests without an authorizer context with 401 (no fallback tenant)", () => {
    expect(() => identityFromEvent(event(null))).toThrow(UnauthorizedError);
  });

  it.each([
    ["no groups claim (signed in, not yet assigned)", { sub: "x", email: "someone@example.com" }],
    ["only non-household groups", { "cognito:groups": "[eu-central-1_TEST_Google]" }],
    ["two household groups", { "cognito:groups": "[household:default:STEFAN household:default:JULIA]" }],
    ["invalid member ID", { "cognito:groups": "[household:default:bob]" }],
    ["malformed tenant", { "cognito:groups": "[household:default#other:STEFAN]" }],
    ["missing user", { "cognito:groups": "[household:default]" }],
    ["legacy custom attributes only", { "custom:tenantId": "default", "custom:userId": "STEFAN" }],
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

describe("groupsOf", () => {
  it("parses the flattened HTTP API format and real arrays", () => {
    expect(groupsOf("[a b]")).toEqual(["a", "b"]);
    expect(groupsOf("[a,b]")).toEqual(["a", "b"]);
    expect(groupsOf("a")).toEqual(["a"]);
    expect(groupsOf("[]")).toEqual([]);
    expect(groupsOf(["a", "b"])).toEqual(["a", "b"]);
    expect(groupsOf(undefined)).toEqual([]);
    expect(groupsOf(42)).toEqual([]);
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
