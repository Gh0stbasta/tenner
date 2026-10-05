/**
 * Profile (FRONTEND-008). The current user comes from the Google login (SECURITY-003/004, HOTFIX-001) and is
 * shown read-only; choosing another person here would undermine the server-side identity.
 */

import { Button, Typography } from "@mui/material";
import { useCurrentUser, useLogout } from "../completions/CurrentUserProvider";
import { SettingsSection } from "./SettingsSection";
import { useMemberName } from "../members/api";

export function ProfileSettings() {
  const memberName = useMemberName();
  const user = useCurrentUser();
  const logout = useLogout();
  return (
    <SettingsSection
      title="Profil"
      description="Du bist mit deinem Google-Konto angemeldet. Die Person ist fest mit dem Konto verknüpft."
    >
      <Typography sx={{ mb: 2 }}>
        Angemeldet als <strong>{memberName(user)}</strong>
      </Typography>
      <Button variant="outlined" onClick={logout}>
        Abmelden
      </Button>
    </SettingsSection>
  );
}
