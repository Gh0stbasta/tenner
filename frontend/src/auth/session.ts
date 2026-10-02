/** Identity helpers (SECURITY-003): household member from the ID token, Cognito URLs. */

import type { AuthConfig } from "../config";
import { USER_IDS, type UserId } from "../types/domain";

export const CALLBACK_PATH = "/auth/callback";
export const LOGIN_LANGUAGE = "de";

/** custom:userId from the ID token claims, if it is a known household member. */
export function userIdFromProfile(profile: Readonly<Record<string, unknown>> | undefined): UserId | undefined {
  const value = profile?.["custom:userId"];
  return typeof value === "string" && (USER_IDS as readonly string[]).includes(value) ? (value as UserId) : undefined;
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
