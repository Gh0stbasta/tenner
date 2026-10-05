/** Identity helpers (SECURITY-003, FUTURE-011): household member from the ID token, Cognito URLs. */

import type { AuthConfig } from "../config";
import { USER_IDS, type UserId } from "../types/domain";

export const CALLBACK_PATH = "/auth/callback";

/** Extra parameters of the Cognito authorize request: German pages, straight to Google (no Cognito login page). */
export const LOGIN_PARAMS = { lang: "de", identity_provider: "Google" } as const;

const HOUSEHOLD_GROUP_PATTERN = /^household:[A-Za-z0-9_-]{1,64}:([A-Z]+)$/;

/**
 * Household member from the cognito:groups claim: exactly one group "household:<tenantId>:<userId>" with a known
 * user (same rule as the backend). Undefined for signed-in Google users that are not (yet) in the household.
 */
export function userIdFromProfile(profile: Readonly<Record<string, unknown>> | undefined): UserId | undefined {
  const claim = profile?.["cognito:groups"];
  const groups = Array.isArray(claim) ? claim : [];
  const household = groups.filter(
    (group): group is string => typeof group === "string" && group.startsWith("household:"),
  );
  if (household.length !== 1) return undefined;
  const userId = HOUSEHOLD_GROUP_PATTERN.exec(household[0] ?? "")?.[1];
  return userId !== undefined && (USER_IDS as readonly string[]).includes(userId) ? (userId as UserId) : undefined;
}

/** Cognito logout endpoint: ends the managed login session and returns to the app. */
export function buildLogoutUrl(auth: AuthConfig, origin: string): string {
  const params = new URLSearchParams({ client_id: auth.clientId, logout_uri: `${origin}/` });
  return `${auth.loginUrl}/logout?${params.toString()}`;
}

/** Where to return after login: the current path, never the callback route itself. */
export function returnPath(location: Pick<Location, "pathname" | "search">): string {
  return location.pathname.startsWith(CALLBACK_PATH) ? "/dashboard" : `${location.pathname}${location.search}`;
}
