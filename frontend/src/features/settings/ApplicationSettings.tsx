/** Application preferences (FRONTEND-008): theme, timezone (read-only for the MVP). */

import { Stack, TextField } from "@mui/material";
import { SettingsSection } from "./SettingsSection";
import { ThemeSelector } from "./ThemeSelector";

/** Timezone the backend uses for due dates (APPLICATION_TIMEZONE, TICKET-016). */
export const APP_TIMEZONE = "Europe/Berlin";

export function ApplicationSettings() {
  return (
    <SettingsSection title="App">
      <Stack spacing={2}>
        <ThemeSelector />
        <TextField
          label="Zeitzone"
          value={APP_TIMEZONE}
          helperText="Fälligkeiten werden in dieser Zeitzone berechnet. Ändern ist noch nicht möglich."
          slotProps={{ htmlInput: { readOnly: true } }}
          fullWidth
        />
      </Stack>
    </SettingsSection>
  );
}
