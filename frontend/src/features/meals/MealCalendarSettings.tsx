/**
 * „Essensplan im Kalender“ (FOOD-015): a private ICS link for Google, Apple or Outlook. The link is shown once after
 * creating it (only its hash is stored); a new link or „Link widerrufen“ stops the old one.
 */

import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { formatLongDate } from "../../utils/format";
import { SettingsSection } from "../settings/SettingsSection";
import { calendarUrls, useCalendarStatus, useCreateCalendarToken, useRevokeCalendarToken } from "./api";

export function MealCalendarSettings() {
  const notify = useNotify();
  const status = useCalendarStatus();
  const create = useCreateCalendarToken();
  const revoke = useRevokeCalendarToken();
  const [token, setToken] = useState<string | null>(null);
  const urls = token ? calendarUrls(token) : null;
  const error = status.error ?? create.error ?? revoke.error;

  const createLink = () =>
    create.mutate(undefined, {
      onSuccess: (created) => setToken(created.token),
    });

  const copy = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      notify({ message: "Kalender-Link kopiert." });
    } catch {
      notify({ severity: "error", message: "Kopieren ging nicht. Bitte den Link markieren und kopieren." });
    }
  };

  return (
    <SettingsSection
      title="Essen: Kalender"
      description="Der Essensplan dieser und nächster Woche als Termine in eurem Kalender (Google, Apple, Outlook). Nur Gerichtsnamen, keine Allergien."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error)}
        </Alert>
      )}
      {urls ? (
        <Stack spacing={1.5}>
          <Alert severity="warning">
            Dieser Link wird nur jetzt angezeigt. Wer ihn hat, sieht euren Essensplan – nur an die Familie weitergeben.
          </Alert>
          <TextField
            label="Kalender-Link"
            value={urls.https}
            slotProps={{ htmlInput: { readOnly: true } }}
            fullWidth
            size="small"
          />
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" onClick={() => void copy()}>
              Link kopieren
            </Button>
            <Button variant="outlined" href={urls.webcal}>
              In Apple Kalender öffnen
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Google Kalender: Weitere Kalender „+“ → „Per URL“ → Link einfügen. Apple: Button oben oder Kalender → Ablage
            → Neues Kalenderabonnement. Kalender-Apps holen Änderungen selbst ab, Google manchmal erst nach bis zu 24
            Stunden.
          </Typography>
          <Box>
            <Button size="small" onClick={() => setToken(null)}>
              Fertig
            </Button>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2">
            {status.data?.active
              ? `Ein Kalender-Link ist aktiv${status.data.createdAt ? ` (erstellt am ${formatLongDate(status.data.createdAt.slice(0, 10))})` : ""}.`
              : "Noch kein Kalender-Link."}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="outlined" onClick={createLink} disabled={create.isPending || status.isPending}>
              {status.data?.active ? "Neuen Link erstellen" : "Kalender abonnieren"}
            </Button>
            {status.data?.active && (
              <Button
                color="inherit"
                onClick={() =>
                  revoke.mutate(undefined, {
                    onSuccess: () =>
                      notify({ message: "Kalender-Link widerrufen. Der Kalender bekommt keine Termine mehr." }),
                  })
                }
                disabled={revoke.isPending}
              >
                Link widerrufen
              </Button>
            )}
          </Box>
          {status.data?.active && (
            <Typography variant="caption" color="text.secondary">
              Ein neuer Link ersetzt den alten; Kalender mit dem alten Link bekommen dann keine Termine mehr.
            </Typography>
          )}
        </Stack>
      )}
    </SettingsSection>
  );
}
