/** Household-wide settings (HOUSEHOLD-ADMIN-003): name, timezone, week start, workdays and vacation. */

import { Box, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "../../types/domain";
import { useHousehold, useUpdateHousehold, WEEK_STARTS, type HouseholdChanges, type WeekStart } from "../household/api";
import { SettingsSection } from "./SettingsSection";
import { TimezoneSetting } from "./TimezoneSetting";
import { VacationSetting } from "./VacationSetting";

const WEEK_START_LABELS: Readonly<Record<WeekStart, string>> = { MONDAY: "Montag", SUNDAY: "Sonntag" };
const NAME_MAX = 60;

/** Name field that saves when it is left (not on every keystroke). */
function HouseholdName({ name, onSave }: { readonly name: string; readonly onSave: (name: string) => void }) {
  const [text, setText] = useState(name);
  const [saved, setSaved] = useState(name);
  if (name !== saved) {
    setSaved(name);
    setText(name);
  }
  const trimmed = text.trim();
  const valid = trimmed !== "" && trimmed.length <= NAME_MAX;
  return (
    <TextField
      label="Name des Haushalts"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!valid) setText(name);
        else if (trimmed !== name) onSave(trimmed);
      }}
      error={!valid}
      helperText={valid ? undefined : `1 bis ${NAME_MAX} Zeichen.`}
      fullWidth
    />
  );
}

export function HouseholdSettings() {
  const workdaysId = useId();
  const household = useHousehold();
  const update = useUpdateHousehold();
  const notify = useNotify();
  const save = (changes: HouseholdChanges, message?: string) =>
    update.mutate(changes, {
      onSuccess: () => message && notify({ message }),
      onError: (error) => notify({ message: `Speichern fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
    });
  const data = household.data;

  const toggleWorkday = (day: Weekday) => {
    if (!data) return;
    const next = data.workdays.includes(day) ? data.workdays.filter((d) => d !== day) : [...data.workdays, day];
    if (next.length > 0) save({ workdays: WEEKDAYS.filter((d) => next.includes(d)) });
  };

  return (
    <SettingsSection title="Haushalt" description="Gilt für alle im Haushalt.">
      <Stack spacing={2}>
        {data && <HouseholdName name={data.name} onSave={(name) => save({ name }, "Name gespeichert.")} />}
        <TimezoneSetting />
        {data && (
          <>
            <TextField
              select
              label="Woche beginnt am"
              value={data.weekStartsOn}
              onChange={(event) => save({ weekStartsOn: event.target.value as WeekStart })}
              fullWidth
            >
              {WEEK_STARTS.map((start) => (
                <MenuItem key={start} value={start}>
                  {WEEK_START_LABELS[start]}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="body2" color="text.secondary" id={workdaysId} sx={{ mb: 1 }}>
                Arbeitstage
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
                role="group"
                aria-labelledby={workdaysId}
              >
                {WEEKDAYS.map((day) => (
                  <Chip
                    key={day}
                    label={WEEKDAY_LABELS[day]}
                    color={data.workdays.includes(day) ? "primary" : "default"}
                    variant={data.workdays.includes(day) ? "filled" : "outlined"}
                    aria-pressed={data.workdays.includes(day)}
                    disabled={update.isPending}
                    onClick={() => toggleWorkday(day)}
                  />
                ))}
              </Stack>
            </Box>
          </>
        )}
        <VacationSetting />
      </Stack>
    </SettingsSection>
  );
}
