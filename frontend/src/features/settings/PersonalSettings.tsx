/** Personal preferences on this device (FRONTEND-008): default assignee and theme. */

import { MenuItem, Stack, TextField } from "@mui/material";
import { useAssignees } from "../members/useAssignees";
import type { DefaultAssignee } from "./preferences";
import { SettingsSection } from "./SettingsSection";
import { useSettings } from "./SettingsProvider";
import { ThemeSelector } from "./ThemeSelector";

export function PersonalSettings() {
  const { preferences, update } = useSettings();
  const assignees = useAssignees(preferences.defaultAssignedTo === "SELF" ? undefined : preferences.defaultAssignedTo, {
    includeShared: true,
  });
  return (
    <SettingsSection title="Persönlich" description="Nur auf diesem Gerät.">
      <Stack spacing={2}>
        <TextField
          select
          label="Zuständig für neue Aufgaben"
          value={preferences.defaultAssignedTo}
          onChange={(event) => update({ defaultAssignedTo: event.target.value as DefaultAssignee })}
          fullWidth
        >
          <MenuItem value="SELF">Ich selbst</MenuItem>
          {assignees.map((member) => (
            <MenuItem key={member.userId} value={member.userId}>
              {member.displayName}
            </MenuItem>
          ))}
        </TextField>
        <ThemeSelector />
      </Stack>
    </SettingsSection>
  );
}
