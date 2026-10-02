/**
 * OIDC client for Cognito (SECURITY-003, ADR 0001): Authorization Code flow with PKCE,
 * tokens in localStorage (30-day refresh token), ID token for the API.
 */

import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import type { ApiAuth } from "../api/client";
import type { AuthConfig } from "../config";
import { CALLBACK_PATH, LOGIN_PARAMS, returnPath } from "./session";

export function createUserManager(auth: AuthConfig, origin: string = window.location.origin): UserManager {
  return new UserManager({
    authority: auth.issuerUrl,
    client_id: auth.clientId,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: "code",
    scope: "openid email",
    // Owner decision 2026-10-02: stay logged in on the device (ADR 0001, XSS trade-off documented there).
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
    extraQueryParams: { ...LOGIN_PARAMS },
  });
}

/** Start the login and come back to the current page afterwards. */
export function redirectToLogin(userManager: UserManager): Promise<void> {
  return userManager.signinRedirect({ state: { returnTo: returnPath(window.location) } });
}

/** API client hooks: fresh ID token, one refresh attempt on 401, login redirect if that fails. */
export function createApiAuth(userManager: UserManager): ApiAuth {
  const refresh = async (): Promise<string | undefined> => {
    try {
      const user = await userManager.signinSilent();
      return user?.id_token;
    } catch {
      return undefined;
    }
  };
  return {
    getToken: async () => {
      const user = await userManager.getUser();
      if (user && !user.expired && user.id_token) return user.id_token;
      return user ? refresh() : undefined;
    },
    refreshToken: refresh,
    onUnauthorized: () => void redirectToLogin(userManager),
  };
}
