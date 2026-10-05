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
import { AssignmentPage } from "../features/onboarding/AssignmentPage";
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
  const login = useCallback(
    () =>
      void auth.signinRedirect({
        state: { returnTo: returnPath(location) },
        extraQueryParams: { ...LOGIN_PARAMS },
      }),
    [auth, location],
  );

  const needsLogin = !auth.isLoading && !auth.isAuthenticated && !auth.error && !auth.activeNavigator;
  useEffect(() => {
    if (needsLogin && !redirecting.current) {
      redirecting.current = true;
      login();
    }
  }, [needsLogin, login]);

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
    <CurrentUserProvider user={user} logout={onLogout}>
      <CompletionProvider>{children}</CompletionProvider>
    </CurrentUserProvider>
  );
}
