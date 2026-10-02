/** /auth/callback (SECURITY-003): react-oidc-context exchanges the code; then return to the original page. */

import { Box, Button } from "@mui/material";
import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageLoading } from "../components/LoadingState";

function returnTo(state: unknown): string {
  const target = (state as { returnTo?: unknown } | undefined)?.returnTo;
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard";
}

export function AuthCallbackPage() {
  const auth = useAuth();
  if (auth.error) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <ErrorAlert title="Anmeldung fehlgeschlagen" message="Der Anmeldevorgang konnte nicht abgeschlossen werden." />
        <Button sx={{ mt: 2 }} variant="contained" href="/dashboard">
          Erneut versuchen
        </Button>
      </Box>
    );
  }
  if (auth.isAuthenticated && auth.user) return <Navigate to={returnTo(auth.user.state)} replace />;
  return <PageLoading label="Anmeldung wird abgeschlossen" />;
}
