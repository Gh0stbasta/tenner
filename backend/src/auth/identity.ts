/**
 * Authenticated identity of a request (SECURITY-004, FUTURE-011).
 *
 * API Gateway's JWT authorizer verifies the Cognito ID token (signature, issuer, audience, expiry)
 * before the Lambda runs. This module only reads the verified claims; it never trusts identity
 * fields from the request body, headers or query string, and it never falls back to a default tenant.
 *
 * Household membership is a Cognito group "household:<tenantId>:<userId>" (e.g. household:default:STEFAN),
 * which an administrator assigns. Anyone with a Google account can sign in, but only group members get access.
 */

import { ForbiddenError, UnauthorizedError } from "../exceptions/index.js";
import { USER_IDS, type UserId } from "../models/index.js";
import type { ApiEvent } from "../types/api.js";

/** Cognito group claim in the ID token. */
export const GROUPS_CLAIM = "cognito:groups";
/** Prefix of household membership groups. */
export const HOUSEHOLD_GROUP_PREFIX = "household:";

/** Tenant and acting user, derived exclusively from verified JWT claims. */
export interface Identity {
  readonly tenantId: string;
  readonly userId: UserId;
}

const HOUSEHOLD_GROUP_PATTERN = /^household:([A-Za-z0-9_-]{1,64}):([A-Z]+)$/;

type ClaimValue = string | number | boolean | readonly string[];
type Claims = Readonly<Record<string, ClaimValue>>;

function claimsOf(event: ApiEvent): Claims | undefined {
  // Payload 2.0 with a JWT authorizer: requestContext.authorizer.jwt.claims.
  const context = event.requestContext as { authorizer?: { jwt?: { claims?: Claims } } } | undefined;
  return context?.authorizer?.jwt?.claims;
}

/**
 * Group names from the claim. HTTP API JWT authorizers pass array claims as one string "[a b]";
 * a real array is accepted too. Group names never contain spaces.
 */
export function groupsOf(value: ClaimValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter((group): group is string => typeof group === "string");
  if (typeof value !== "string") return [];
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/[\s,]+/)
    .filter((group) => group !== "");
}

/**
 * Build the identity from the verified claims.
 * No verified claims (route without authorizer, misconfiguration) → 401 UNAUTHORIZED.
 * A valid token without exactly one valid household group → 403 FORBIDDEN
 * (403 rather than 401: a fresh token would not help, and the frontend treats 401 as "log in again").
 */
export function identityFromEvent(event: ApiEvent): Identity {
  const claims = claimsOf(event);
  if (!claims) throw new UnauthorizedError("Authentication required.");
  const householdGroups = groupsOf(claims[GROUPS_CLAIM]).filter((group) => group.startsWith(HOUSEHOLD_GROUP_PREFIX));
  if (householdGroups.length === 0) throw new ForbiddenError("The account is not set up for Tenner.");
  if (householdGroups.length > 1) throw new ForbiddenError("The account belongs to more than one household member.");
  const match = HOUSEHOLD_GROUP_PATTERN.exec(householdGroups[0] ?? "");
  const tenantId = match?.[1];
  const userId = match?.[2];
  if (tenantId === undefined || userId === undefined) throw new ForbiddenError("The account's household group is invalid.");
  if (!(USER_IDS as readonly string[]).includes(userId)) throw new ForbiddenError("The account's user is not a household member.");
  return { tenantId, userId: userId as UserId };
}

/**
 * The acting user for fields that record who performed an action (revertedBy, restoredBy).
 * Omitted → the authenticated user; a different user → 403, so audit data cannot be spoofed.
 */
export function actingUser(identity: Identity, requested: UserId | undefined, field: string): UserId {
  if (requested !== undefined && requested !== identity.userId) {
    throw new ForbiddenError(`${field} must be the authenticated user.`);
  }
  return identity.userId;
}
