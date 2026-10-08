/** Which dashboard sections are shown (FRONTEND-008). */

import { FormControlLabel, FormGroup, Switch } from "@mui/material";
import type { UserPreferences } from "./preferences";
import { SettingsSection } from "./SettingsSection";
import { useSettings } from "./SettingsProvider";

type DashboardToggle = "showUpcoming" | "showCategorySummary" | "showUserSummary" | "showRecentActivity";

const TOGGLES: readonly { readonly key: DashboardToggle; readonly label: string }[] = [
  { key: "showUpcoming", label: "Demnächst fällige Aufgaben" },
  { key: "showUserSummary", label: "Übersicht nach Person" },
  { key: "showCategorySummary", label: "Übersicht nach Kategorie" },
  { key: "showRecentActivity", label: "Letzte Erledigungen" },
];

export function DashboardSettings() {
  const { preferences, update } = useSettings();
  return (
    <SettingsSection title="Dashboard" description="Heute fällige und überfällige Aufgaben werden immer angezeigt.">
      <FormGroup>
        {TOGGLES.map(({ key, label }) => (
          <FormControlLabel
            key={key}
            label={label}
            control={
              <Switch
                checked={preferences[key]}
                onChange={(event) => update({ [key]: event.target.checked } as Partial<UserPreferences>)}
              />
            }
          />
        ))}
      </FormGroup>
    </SettingsSection>
  );
}
