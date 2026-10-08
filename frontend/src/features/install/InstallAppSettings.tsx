/** "App installieren" in the personal settings (MOBILE-001); hidden where installing is not possible. */

import GetAppOutlinedIcon from "@mui/icons-material/GetAppOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import { Alert, Button, Typography } from "@mui/material";
import { SettingsSection } from "../settings/SettingsSection";
import { promptInstall, useInstallStatus } from "./installPrompt";

export function InstallAppSettings() {
  const status = useInstallStatus();
  if (status === "unsupported") return null;
  return (
    <SettingsSection title="App" description="Die Zentrale auf dem Startbildschirm, ohne Browserleiste.">
      {status === "installed" && <Alert severity="success">Die Zentrale ist auf diesem Gerät als App installiert.</Alert>}
      {status === "available" && (
        <Button variant="contained" startIcon={<GetAppOutlinedIcon />} onClick={() => void promptInstall()}>
          App installieren
        </Button>
      )}
      {status === "ios" && (
        <Typography variant="body2" component="ol" sx={{ pl: 2.5, m: 0 }}>
          <li>
            In Safari unten auf <IosShareIcon fontSize="inherit" aria-label="Teilen" sx={{ verticalAlign: "middle" }} />{" "}
            „Teilen“ tippen.
          </li>
          <li>„Zum Home-Bildschirm“ wählen.</li>
          <li>„Hinzufügen“ bestätigen.</li>
        </Typography>
      )}
    </SettingsSection>
  );
}
