/**
 * Household timezone (SCHEDULING-008): editable, applies to the whole household. All "today", due and overdue
 * decisions use it, so changing it can move Tenners between "today" and "overdue".
 */

import { Alert, Autocomplete, TextField } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { availableTimezones, useHousehold, useUpdateHousehold } from "../household/api";

const TIMEZONES = availableTimezones();

export function TimezoneSetting() {
  const household = useHousehold();
  const update = useUpdateHousehold();
  const notify = useNotify();
  const value = update.isPending ? (update.variables?.timezone ?? null) : (household.data?.timezone ?? null);

  return (
    <>
      <Autocomplete
        options={TIMEZONES}
        value={value}
        loading={household.isPending}
        disabled={household.isPending || household.isError || update.isPending}
        disableClearable={value !== null}
        onChange={(_event, timezone) => {
          if (!timezone || timezone === household.data?.timezone) return;
          update.mutate(
            { timezone },
            {
              onSuccess: (saved) => notify({ message: `Zeitzone auf ${saved.timezone} geändert.` }),
            },
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Zeitzone des Haushalts"
            helperText="Gilt für alle im Haushalt: Fälligkeiten und „heute“ werden in dieser Zeitzone berechnet."
          />
        )}
        fullWidth
      />
      {household.isError && (
        <Alert severity="warning">Die Zeitzone konnte nicht geladen werden. {errorMessage(household.error)}</Alert>
      )}
      {update.isError && (
        <Alert severity="error">Die Zeitzone konnte nicht gespeichert werden. {errorMessage(update.error)}</Alert>
      )}
    </>
  );
}
