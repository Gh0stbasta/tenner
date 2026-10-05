/** Light, dark or system theme (FRONTEND-008); applies immediately. */

import { MenuItem, TextField } from "@mui/material";
import type { ThemeMode } from "./preferences";
import { useThemePreference } from "./SettingsProvider";

const LABELS: Readonly<Record<ThemeMode, string>> = { SYSTEM: "Wie das Gerät", LIGHT: "Hell", DARK: "Dunkel" };

export function ThemeSelector() {
  const [theme, setTheme] = useThemePreference();
  return (
    <TextField
      select
      label="Darstellung"
      value={theme}
      onChange={(event) => setTheme(event.target.value as ThemeMode)}
      fullWidth
    >
      {(Object.keys(LABELS) as ThemeMode[]).map((mode) => (
        <MenuItem key={mode} value={mode}>
          {LABELS[mode]}
        </MenuItem>
      ))}
    </TextField>
  );
}
