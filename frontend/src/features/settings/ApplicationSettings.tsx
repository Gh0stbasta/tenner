/** Application preferences (FRONTEND-008): theme; household timezone (SCHEDULING-008). */

import { Stack } from "@mui/material";
import { SettingsSection } from "./SettingsSection";
import { ThemeSelector } from "./ThemeSelector";
import { TimezoneSetting } from "./TimezoneSetting";

export function ApplicationSettings() {
  return (
    <SettingsSection title="App">
      <Stack spacing={2}>
        <ThemeSelector />
        <TimezoneSetting />
      </Stack>
    </SettingsSection>
  );
}
