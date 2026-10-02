/**
 * Authenticated identity of a request (SECURITY-004).
 *
 * API Gateway's JWT authorizer verifies the Cognito ID token (signature, issuer, audience, expiry)
 * before the Lambda runs. This module only reads the verified claims; it never trusts identity
 * fields from the request body, headers or query string, and it never falls back to a default tenant.
 */

import { ForbiddenError, UnauthorizedError } from "../exceptions/index.js";
import { USER_IDS, type UserId } from "../models/index.js";
import type { ApiEvent } from "../types/api.js";

/** Cognito custom attributes as they appear in the ID token. */
export const TENANT_CLAIM = "custom:tenantId";
export const USER_CLAIM = "custom:userId";

/** Tenant and acting user, derived exclusively from verified JWT claims. */
export interface Identity {
  readonly tenantId: string;
  readonly userId: UserId;
}

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type Claims = Readonly<Record<string, string | number | boolean | readonly string[]>>;

function claimsOf(event: ApiEvent): Claims | undefined {
  // Payload 2.0 with a JWT authorizer: requestContext.authorizer.jwt.claims.
  const context = event.requestContext as { authorizer?: { jwt?: { claims?: Claims } } } | undefined;
  return context?.authorizer?.jwt?.claims;
}

function stringClaim(claims: Claims, name: string): string | undefined {
  const value = claims[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Build the identity from the verified claims.
 * No verified claims (route without authorizer, misconfiguration) → 401 UNAUTHORIZED.
 * A valid token whose account lacks or has unusable tenant/user attributes → 403 FORBIDDEN.
 * (403 rather than 401: a fresh token would not help, and the frontend treats 401 as "log in again".)
 */
export function identityFromEvent(event: ApiEvent): Identity {
  const claims = claimsOf(event);
  if (!claims) throw new UnauthorizedError("Authentication required.");
  const tenantId = stringClaim(claims, TENANT_CLAIM);
  const userId = stringClaim(claims, USER_CLAIM);
  if (tenantId === undefined || userId === undefined) throw new ForbiddenError("The account is not set up for Tenner.");
  if (!TENANT_ID_PATTERN.test(tenantId)) throw new ForbiddenError("The account's household is invalid.");
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
