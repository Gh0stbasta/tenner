/**
 * Profile (FRONTEND-008). The current user comes from the Google login (SECURITY-003/004, HOTFIX-001) and is
 * shown read-only; choosing another person here would undermine the server-side identity.
 */

import { Button, Typography } from "@mui/material";
import { USER_LABELS } from "../../types/domain";
import { useCurrentUser, useLogout } from "../completions/CurrentUserProvider";
import { SettingsSection } from "./SettingsSection";

export function ProfileSettings() {
  const user = useCurrentUser();
  const logout = useLogout();
  return (
    <SettingsSection
      title="Profil"
      description="Du bist mit deinem Google-Konto angemeldet. Die Person ist fest mit dem Konto verknüpft."
    >
      <Typography sx={{ mb: 2 }}>
        Angemeldet als <strong>{USER_LABELS[user]}</strong>
      </Typography>
      <Button variant="outlined" onClick={logout}>
        Abmelden
      </Button>
    </SettingsSection>
  );
}
