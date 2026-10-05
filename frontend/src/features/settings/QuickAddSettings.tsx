/** Defaults for Quick Add and new Tenners (FRONTEND-008). Numbers are saved when valid. */

import { MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, USER_IDS, USER_LABELS, type Category } from "../../types/domain";
import { FREQUENCY_RANGE, MINUTES_RANGE, type DefaultAssignee } from "./preferences";
import { SettingsSection } from "./SettingsSection";
import { useSettings } from "./SettingsProvider";

interface NumberSettingProps {
  readonly label: string;
  readonly value: number;
  readonly range: { readonly min: number; readonly max: number };
  readonly onSave: (value: number) => void;
}

/** Number input that keeps the typed text and saves only whole numbers within the range. */
function NumberSetting({ label, value, range, onSave }: NumberSettingProps) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (e.g. "reset to defaults") without overwriting what the user is typing.
  const [savedValue, setSavedValue] = useState(value);
  if (value !== savedValue) {
    setSavedValue(value);
    if (Number(text) !== value) setText(String(value));
  }
  const parsed = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(parsed) && parsed >= range.min && parsed <= range.max;
  return (
    <TextField
      label={label}
      type="number"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value);
        if (event.target.value.trim() !== "" && Number.isInteger(next) && next >= range.min && next <= range.max)
          onSave(next);
      }}
      onBlur={() => {
        if (!valid) setText(String(value));
      }}
      error={!valid}
      helperText={
        valid ? `${range.min} – ${range.max}` : `Bitte eine ganze Zahl von ${range.min} bis ${range.max} eingeben.`
      }
      slotProps={{ htmlInput: { min: range.min, max: range.max, inputMode: "numeric" } }}
      fullWidth
    />
  );
}

export function QuickAddSettings() {
  const { preferences, update } = useSettings();
  return (
    <SettingsSection
      title="Standardwerte für neue Tenner"
      description="Gilt für „Schnell anlegen“ und den Dialog „Neuer Tenner“."
    >
      <Stack spacing={2}>
        <TextField
          select
          label="Kategorie"
          value={preferences.defaultCategory}
          onChange={(event) => update({ defaultCategory: event.target.value as Category })}
          fullWidth
        >
          {CATEGORIES.map((category) => (
            <MenuItem key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Zuständig"
          value={preferences.defaultAssignedTo}
          onChange={(event) => update({ defaultAssignedTo: event.target.value as DefaultAssignee })}
          fullWidth
        >
          <MenuItem value="SELF">Ich selbst</MenuItem>
          {USER_IDS.map((user) => (
            <MenuItem key={user} value={user}>
              {USER_LABELS[user]}
            </MenuItem>
          ))}
        </TextField>
        <NumberSetting
          label="Geschätzte Dauer (Minuten)"
          value={preferences.defaultEstimatedMinutes}
          range={MINUTES_RANGE}
          onSave={(defaultEstimatedMinutes) => update({ defaultEstimatedMinutes })}
        />
        <NumberSetting
          label="Häufigkeit (alle … Tage)"
          value={preferences.defaultFrequencyDays}
          range={FREQUENCY_RANGE}
          onSave={(defaultFrequencyDays) => update({ defaultFrequencyDays })}
        />
      </Stack>
    </SettingsSection>
  );
}
