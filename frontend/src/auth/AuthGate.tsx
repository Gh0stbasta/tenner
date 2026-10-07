/**
 * Protects the app (SECURITY-003): redirects to the Cognito login when there is no session and
 * provides the logged-in household member to the rest of the app. Signed-in users without a household
 * member go through the first-login assignment (HOTFIX-001).
 */

import { Box } from "@mui/material";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation, useNavigate } from "react-router";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageLoading } from "../components/LoadingState";
import { CompletionProvider } from "../features/completions/CompletionProvider";
import { CurrentUserProvider } from "../features/completions/CurrentUserProvider";
import { OfflineCacheProvider } from "../features/offline/OfflineCacheProvider";
import { AssignmentPage } from "../features/onboarding/AssignmentPage";
import { useOnline } from "../hooks/useConnectivity";
import type { UserId } from "../types/domain";
import { LOGIN_PARAMS, returnPath, userIdFromProfile } from "./session";

export interface AuthGateProps {
  readonly children: ReactNode;
  /** Ends the Cognito session (clears tokens, opens the logout endpoint). */
  readonly onLogout: () => void;
}

export function AuthGate({ children, onLogout }: AuthGateProps) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirecting = useRef(false);
  const online = useOnline();
  // MOBILE-003: offline, a stored session (even with an expired token) opens the app with the cached data; the
  // login redirect and silent-renew errors wait until the connection is back.
  const offlineUser = !online && auth.user ? userIdFromProfile(auth.user.profile) : undefined;
  const login = useCallback(
    () =>
      void auth.signinRedirect({
        state: { returnTo: returnPath(location) },
        extraQueryParams: { ...LOGIN_PARAMS },
      }),
    [auth, location],
  );

  const needsLogin = !offlineUser && !auth.isLoading && !auth.isAuthenticated && !auth.error && !auth.activeNavigator;
  const hasStoredUser = auth.user !== null && auth.user !== undefined;
  useEffect(() => {
    if (needsLogin && !redirecting.current) {
      redirecting.current = true;
      // MOBILE-003: back online with an expired token, the refresh token usually renews the session silently.
      if (hasStoredUser) void auth.signinSilent().catch(login);
      else login();
    }
  }, [needsLogin, login, hasStoredUser, auth]);

  if (offlineUser)
    return (
      <Session user={offlineUser} onLogout={onLogout}>
        {children}
      </Session>
    );

  if (auth.error) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <ErrorAlert title="Anmeldung fehlgeschlagen" message="Bitte melde dich erneut an." onRetry={login} />
      </Box>
    );
  }
  if (!auth.isAuthenticated || !auth.user) return <PageLoading label="Anmeldung wird geprüft" />;

  const user = userIdFromProfile(auth.user.profile);
  if (!user) {
    // First login (HOTFIX-001): pick the household member, then refresh the token (it then carries the group).
    const continueAfterAssignment = async () => {
      const refreshed = await auth.signinSilent();
      if (!userIdFromProfile(refreshed?.profile)) throw new Error("The refreshed session has no household member.");
      void navigate("/dashboard", { replace: true });
    };
    return <AssignmentPage onAssigned={continueAfterAssignment} onLogout={onLogout} />;
  }

  return (
    <Session user={user} onLogout={onLogout}>
      {children}
    </Session>
  );
}

/** Providers of a logged-in household member: offline cache, current user, completions. */
function Session({
  user,
  onLogout,
  children,
}: {
  readonly user: UserId;
  readonly onLogout: () => void;
  readonly children: ReactNode;
}) {
  return (
    <OfflineCacheProvider user={user}>
      <CurrentUserProvider user={user} logout={onLogout}>
        <CompletionProvider>{children}</CompletionProvider>
      </CurrentUserProvider>
    </OfflineCacheProvider>
  );
}
