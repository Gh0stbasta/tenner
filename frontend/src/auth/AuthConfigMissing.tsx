import { Box } from "@mui/material";
import { ErrorAlert } from "../components/ErrorAlert";

/** Shown when the build has no Cognito settings (VITE_COGNITO_*), e.g. a local build without .env. */
export function AuthConfigMissing() {
  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
      <ErrorAlert
        title="Anmeldung nicht eingerichtet"
        message="Diese Version von Tenner kennt keine Anmeldedaten (VITE_COGNITO_*). Bitte über die Deploy-Pipeline bauen."
      />
    </Box>
  );
}
