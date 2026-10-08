/**
 * Household vacation mode (SCHEDULING-005): Tenners of the chosen categories are paused between the dates; Tenners
 * due within the vacation move behind it, spread over the following days.
 */

import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import type { Category } from "../../types/domain";
import { useCategoryName, useSelectableCategories } from "../categories/api";
import { formatShortDate } from "../../utils/format";
import { useEndVacation, useHousehold, useSetVacation, useToday, type Vacation } from "../household/api";
import { formatTennerCount } from "../../utils/format";

function describe(vacation: Vacation, categoryName: (categoryId: Category) => string): string {
  const categories =
    vacation.categories === null ? "alle Kategorien" : vacation.categories.map(categoryName).join(", ");
  return `${formatShortDate(vacation.from)} – ${formatShortDate(vacation.until)} · ${categories}`;
}

/** Mounted per saved vacation (keyed), so the inputs start from the stored values. */
function VacationForm({ vacation }: { readonly vacation: Vacation | null }) {
  const groupId = useId();
  const today = useToday();
  const notify = useNotify();
  const setVacation = useSetVacation();
  const endVacation = useEndVacation();
  const [from, setFrom] = useState(vacation?.from ?? "");
  const [until, setUntil] = useState(vacation?.until ?? "");
  const [categories, setCategories] = useState<readonly Category[]>(vacation?.categories ?? []);
  const categoryName = useCategoryName();
  // Selectable categories in display order, plus stored vacation categories that are archived meanwhile.
  const selectable = useSelectableCategories().map((category) => category.categoryId);
  const allCategories = [...selectable, ...(vacation?.categories ?? []).filter((c) => !selectable.includes(c))];
  const busy = setVacation.isPending || endVacation.isPending;
  const invalidRange = from !== "" && until !== "" && until < from;
  const inPast = until !== "" && until < today;
  const failure = setVacation.error ?? endVacation.error;

  const toggle = (category: Category) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  const save = () =>
    setVacation.mutate(
      {
        from,
        until,
        ...(categories.length > 0 ? { categories: allCategories.filter((c) => categories.includes(c)) } : {}),
      },
      {
        onSuccess: (result) =>
          notify({
            message: `🏖 Urlaub gespeichert. ${formatTennerCount(result.rescheduled)} nach hinten verschoben.${
              result.conflicts > 0 ? ` ${result.conflicts} wurden gerade geändert und behalten ihr Datum.` : ""
            }`,
          }),
      },
    );

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Urlaub
      </Typography>
      {vacation && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Geplant: {describe(vacation, categoryName)}
        </Alert>
      )}
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Urlaub konnte nicht gespeichert werden. {errorMessage(failure)}
        </Alert>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <TextField
          label="Von"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Bis einschließlich"
          type="date"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
          error={invalidRange || inPast}
          helperText={invalidRange ? "Liegt vor dem Beginn." : inPast ? "Liegt in der Vergangenheit." : undefined}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" id={groupId} sx={{ mt: 2, mb: 1 }}>
        Pausierte Kategorien (ohne Auswahl: alle)
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }} role="group" aria-labelledby={groupId}>
        {allCategories.map((category) => (
          <Chip
            key={category}
            label={categoryName(category)}
            color={categories.includes(category) ? "primary" : "default"}
            variant={categories.includes(category) ? "filled" : "outlined"}
            aria-pressed={categories.includes(category)}
            onClick={() => toggle(category)}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || from === "" || until === "" || invalidRange || inPast}
        >
          Urlaub speichern
        </Button>
        {vacation && (
          <Button
            color="error"
            onClick={() => endVacation.mutate(undefined, { onSuccess: () => notify({ message: "Urlaub beendet." }) })}
            disabled={busy}
          >
            Urlaub beenden
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export function VacationSetting() {
  const household = useHousehold();
  if (household.isPending || household.isError) return null;
  const vacation = household.data.vacation;
  return <VacationForm key={vacation ? `${vacation.from}:${vacation.until}` : "none"} vacation={vacation} />;
}
