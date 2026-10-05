/** Settings (FRONTEND-008): profile, defaults for new Tenners, dashboard sections, app preferences, members. */

import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useNotify } from "../../components/NotificationProvider";
import { PageHeader } from "../../components/PageHeader";
import { ApplicationSettings } from "./ApplicationSettings";
import { DashboardSettings } from "./DashboardSettings";
import { MembersSettings } from "./MembersSettings";
import { ProfileSettings } from "./ProfileSettings";
import { QuickAddSettings } from "./QuickAddSettings";
import { ResetSettingsDialog } from "./ResetSettingsDialog";
import { useSettings } from "./SettingsProvider";

export function SettingsPage() {
  const { reset } = useSettings();
  const notify = useNotify();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Box sx={{ maxWidth: 720 }}>
      <PageHeader title="Einstellungen" subtitle="Änderungen werden sofort auf diesem Gerät gespeichert." />
      <ProfileSettings />
      <QuickAddSettings />
      <DashboardSettings />
      <ApplicationSettings />
      <MembersSettings />
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
          Einstellungen gelten nur für diesen Browser.
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
