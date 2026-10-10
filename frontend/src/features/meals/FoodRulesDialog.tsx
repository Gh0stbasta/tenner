/** Household planning rules of the family food profile (FOOD-004): who eats when, limits and exclusions. */

import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { attendingEaters, type Attendance, type Eater, type HouseholdFoodRules } from "./api";
import {
  ATTENDANCE_LABELS,
  INGREDIENT_TAGS,
  PROTEIN_LABELS,
  PROTEIN_TAGS,
  TAG_LABELS,
  WEEK_SLOTS,
  weekSlotLabel,
} from "./labels";

export interface FoodRulesDialogProps {
  readonly rules: HouseholdFoodRules;
  readonly eaters: readonly Eater[];
  readonly pending: boolean;
  readonly error: unknown;
  readonly onSave: (rules: HouseholdFoodRules) => void;
  readonly onClose: () => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(event) => onChange(Math.min(max, Math.max(min, Math.round(Number(event.target.value) || 0))))}
      slotProps={{ htmlInput: { min, max } }}
      fullWidth
    />
  );
}

export function FoodRulesDialog({ rules, eaters, pending, error, onSave, onClose }: FoodRulesDialogProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<HouseholdFoodRules>(rules);
  const set = <K extends keyof HouseholdFoodRules>(key: K, value: HouseholdFoodRules[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const toggleAttendance = (meal: keyof Attendance, eaterId: string, attending: boolean) => {
    const current = attendingEaters(eaters, draft.attendance, meal).map((eater) => eater.eaterId);
    const next = attending ? [...current, eaterId] : current.filter((id) => id !== eaterId);
    set("attendance", {
      ...draft.attendance,
      [meal]: eaters.map((eater) => eater.eaterId).filter((id) => next.includes(id)),
    });
  };

  return (
    <Dialog open onClose={pending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <DialogTitle id={titleId}>Planungsregeln</DialogTitle>
        <DialogContent>
          {error !== null && error !== undefined && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Speichern fehlgeschlagen. {errorMessage(error)}
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            {eaters.length > 0 &&
              (Object.keys(ATTENDANCE_LABELS) as (keyof Attendance)[]).map((meal) => {
                const attending = new Set(
                  attendingEaters(eaters, draft.attendance, meal).map((eater) => eater.eaterId),
                );
                return (
                  <FormControl key={meal} component="fieldset">
                    <FormLabel component="legend">Wer isst mit? {ATTENDANCE_LABELS[meal]}</FormLabel>
                    <FormGroup row>
                      {eaters.map((eater) => (
                        <FormControlLabel
                          key={eater.eaterId}
                          control={
                            <Checkbox
                              checked={attending.has(eater.eaterId)}
                              onChange={(event) => toggleAttendance(meal, eater.eaterId, event.target.checked)}
                            />
                          }
                          label={eater.name}
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                );
              })}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <NumberField
                label="Max. aktive Kochzeit (Min.)"
                value={draft.maxActiveMinutes}
                min={5}
                max={240}
                onChange={(value) => set("maxActiveMinutes", value)}
              />
              <NumberField
                label="Salat mittags pro Woche"
                value={draft.maxSaladLunchesPerWeek}
                min={0}
                max={7}
                onChange={(value) => set("maxSaladLunchesPerWeek", value)}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <NumberField
                label="Hühnchen pro Woche"
                value={draft.chicken.maxPerWeek}
                min={0}
                max={14}
                onChange={(value) => set("chicken", { ...draft.chicken, maxPerWeek: value })}
              />
              <NumberField
                label="Burger pro Woche"
                value={draft.maxBurgerPerWeek}
                min={0}
                max={14}
                onChange={(value) => set("maxBurgerPerWeek", value)}
              />
            </Stack>
            <Autocomplete
              multiple
              options={WEEK_SLOTS as string[]}
              value={draft.chicken.allowedSlots as string[]}
              onChange={(_, next) =>
                set("chicken", {
                  ...draft.chicken,
                  allowedSlots: next as HouseholdFoodRules["chicken"]["allowedSlots"],
                })
              }
              getOptionLabel={(option) => weekSlotLabel(option as (typeof WEEK_SLOTS)[number])}
              renderInput={(params) => <TextField {...params} label="Hühnchen nur an" />}
            />
            <Autocomplete
              multiple
              options={[...PROTEIN_TAGS]}
              value={draft.limitedProteinTags}
              onChange={(_, next) => set("limitedProteinTags", next)}
              getOptionLabel={(option) => PROTEIN_LABELS[option]}
              renderInput={(params) => <TextField {...params} label="Je höchstens einmal pro Woche" />}
            />
            <Autocomplete
              multiple
              options={[...INGREDIENT_TAGS]}
              value={draft.dislikeTags}
              onChange={(_, next) => set("dislikeTags", next)}
              getOptionLabel={(option) => TAG_LABELS[option]}
              renderInput={(params) => <TextField {...params} label="Nie im Plan" />}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.lightLunchOnWeekdays}
                  onChange={(event) => set("lightLunchOnWeekdays", event.target.checked)}
                />
              }
              label="Mittags unter der Woche leicht"
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <NumberField
                label="€ bis (Euro, ganze Familie)"
                value={draft.costTiers.cheapMax}
                min={1}
                max={100}
                onChange={(value) => set("costTiers", { ...draft.costTiers, cheapMax: value })}
              />
              <NumberField
                label="€€ bis (Euro), darüber €€€"
                value={draft.costTiers.mediumMax}
                min={draft.costTiers.cheapMax + 1}
                max={200}
                onChange={(value) => set("costTiers", { ...draft.costTiers, mediumMax: value })}
              />
            </Stack>
            {draft.lightLunchOnWeekdays && (
              <NumberField
                label="Leichtes Mittagessen bis (kcal, Schätzung)"
                value={draft.lightLunchMaxKcal}
                min={200}
                max={2000}
                onChange={(value) => set("lightLunchMaxKcal", value)}
              />
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Mittagessen um"
                type="time"
                value={draft.mealTimes.lunch}
                onChange={(event) => set("mealTimes", { ...draft.mealTimes, lunch: event.target.value })}
                fullWidth
              />
              <TextField
                label="Abendessen um"
                type="time"
                value={draft.mealTimes.dinner}
                onChange={(event) => set("mealTimes", { ...draft.mealTimes, dinner: event.target.value })}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
