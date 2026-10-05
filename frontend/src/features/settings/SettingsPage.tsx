/**
 * Settings, split into personal (this device, FRONTEND-008) and household-wide (server-side, HOUSEHOLD-ADMIN-001 – 003).
 */

import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useNotify } from "../../components/NotificationProvider";
import { PageHeader } from "../../components/PageHeader";
import { CategoriesSettings } from "./CategoriesSettings";
import { DashboardSettings } from "./DashboardSettings";
import { HouseholdSettings } from "./HouseholdSettings";
import { PersonalSettings } from "./PersonalSettings";
import { TennerDefaultsSettings } from "./TennerDefaultsSettings";
import { MembersSettings } from "./MembersSettings";
import { ProfileSettings } from "./ProfileSettings";
import { ResetSettingsDialog } from "./ResetSettingsDialog";
import { useSettings } from "./SettingsProvider";

export function SettingsPage() {
  const { reset } = useSettings();
  const notify = useNotify();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Einstellungen" subtitle="Änderungen werden sofort gespeichert." />
      <Typography variant="overline" component="h2" color="text.secondary">
        Für mich (nur auf diesem Gerät)
      </Typography>
      <ProfileSettings />
      <PersonalSettings />
      <DashboardSettings />
      <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: "block", mt: 3 }}>
        Für den ganzen Haushalt
      </Typography>
      <HouseholdSettings />
      <TennerDefaultsSettings />
      <MembersSettings />
      <CategoriesSettings />
      <Box
        sx={{
          mt: 3,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { sm: "center" },
          gap: 2,
        }}
      >
        <Button variant="outlined" color="error" onClick={() => setConfirmReset(true)}>
          Auf Standardwerte zurücksetzen
        </Button>
        <Typography variant="body2" color="text.secondary">
          Setzt nur die persönlichen Einstellungen auf diesem Gerät zurück.
        </Typography>
      </Box>
      <ResetSettingsDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          reset();
          setConfirmReset(false);
          notify({ message: "Einstellungen zurückgesetzt." });
        }}
      />
    </Box>
  );
}
