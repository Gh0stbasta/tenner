/**
 * Protects the app (SECURITY-003): redirects to the Cognito login when there is no session and
 * provides the logged-in household member to the rest of the app.
 */

import { Box, Button } from "@mui/material";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useLocation } from "react-router";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageLoading } from "../components/LoadingState";
import { CompletionProvider } from "../features/completions/CompletionProvider";
import { CurrentUserProvider } from "../features/completions/CurrentUserProvider";
import { LOGIN_LANGUAGE, returnPath, userIdFromProfile } from "./session";

export interface AuthGateProps {
  readonly children: ReactNode;
  /** Ends the Cognito session (clears tokens, opens the logout endpoint). */
  readonly onLogout: () => void;
}

export function AuthGate({ children, onLogout }: AuthGateProps) {
  const auth = useAuth();
  const location = useLocation();
  const redirecting = useRef(false);
  const login = useCallback(
    () =>
      void auth.signinRedirect({
        state: { returnTo: returnPath(location) },
        extraQueryParams: { lang: LOGIN_LANGUAGE },
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
    return (
      <EmptyState
        title="Konto nicht eingerichtet"
        description="Deinem Konto ist noch keine Person im Haushalt zugeordnet (custom:userId). Bitte wende dich an die Person, die Tenner verwaltet."
        action={
          <Button variant="contained" onClick={onLogout}>
            Abmelden
          </Button>
        }
      />
    );
  }

  return (
    <CurrentUserProvider user={user} logout={onLogout}>
      <CompletionProvider>{children}</CompletionProvider>
    </CurrentUserProvider>
  );
}
