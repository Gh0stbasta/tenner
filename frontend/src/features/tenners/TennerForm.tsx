/** Shared Tenner form fields for Create and Edit (FRONTEND-004/005). */

import { Box, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { Controller, type UseFormReturn } from "react-hook-form";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  FREQUENCY_UNITS,
  FREQUENCY_UNIT_LABELS,
  USER_IDS,
  USER_LABELS,
} from "../../types/domain";
import { FREQUENCY_PRESETS, type TennerFormValues } from "./tennerForm.schema";

export interface TennerFormProps {
  readonly form: UseFormReturn<TennerFormValues>;
  /** Show the Active switch (Edit only). */
  readonly showActive?: boolean;
  readonly disabled?: boolean;
}

export function TennerForm({ form, showActive = false, disabled = false }: TennerFormProps) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const [unit, interval] = watch(["frequencyUnit", "frequencyInterval"]);
  const isPreset = (preset: (typeof FREQUENCY_PRESETS)[number]) => preset.unit === unit && preset.interval === interval;

  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <TextField
        label="Titel"
        placeholder="Büro saugen"
        required
        autoFocus
        disabled={disabled}
        error={errors.title !== undefined}
        helperText={errors.title?.message}
        {...register("title")}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <TextField
              select
              label="Kategorie"
              required
              disabled={disabled}
              error={errors.category !== undefined}
              helperText={errors.category?.message}
              {...field}
            >
              {CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          control={control}
          name="assignedTo"
          render={({ field }) => (
            <TextField
              select
              label="Zuständig"
              required
              disabled={disabled}
              error={errors.assignedTo !== undefined}
              helperText={errors.assignedTo?.message}
              {...field}
            >
              {USER_IDS.map((user) => (
                <MenuItem key={user} value={user}>
                  {USER_LABELS[user]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <TextField
          label="Geschätzte Minuten"
          type="number"
          required
          disabled={disabled}
          error={errors.estimatedMinutes !== undefined}
          helperText={errors.estimatedMinutes?.message ?? "Typische Dauer in Minuten."}
          slotProps={{ htmlInput: { min: 1, max: 480, inputMode: "numeric" } }}
          {...register("estimatedMinutes", { valueAsNumber: true })}
        />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <TextField
          label="Wiederholen alle"
          type="number"
          required
          disabled={disabled}
          error={errors.frequencyInterval !== undefined}
          helperText={errors.frequencyInterval?.message ?? "Ab der letzten Erledigung."}
          slotProps={{ htmlInput: { min: 1, max: 3650, inputMode: "numeric" } }}
          {...register("frequencyInterval", { valueAsNumber: true })}
        />
        <Controller
          control={control}
          name="frequencyUnit"
          render={({ field }) => (
            <TextField
              select
              label="Einheit"
              required
              disabled={disabled}
              error={errors.frequencyUnit !== undefined}
              helperText={errors.frequencyUnit?.message ?? "Monate und Jahre bleiben auf dem Kalendertag."}
              {...field}
              onChange={(event) => {
                field.onChange(event);
                // Re-check the 10-year limit, which depends on both fields.
                void form.trigger("frequencyInterval");
              }}
            >
              {FREQUENCY_UNITS.map((option) => (
                <MenuItem key={option} value={option}>
                  {FREQUENCY_UNIT_LABELS[option]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Box>
      <Box>
        <Typography variant="body2" color="text.secondary" id="frequency-presets" sx={{ mb: 1 }}>
          Schnellauswahl Häufigkeit
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: "wrap" }}
          role="group"
          aria-labelledby="frequency-presets"
        >
          {FREQUENCY_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              color={isPreset(preset) ? "primary" : "default"}
              variant={isPreset(preset) ? "filled" : "outlined"}
              disabled={disabled}
              aria-pressed={isPreset(preset)}
              onClick={() => {
                setValue("frequencyUnit", preset.unit, { shouldDirty: true, shouldValidate: true });
                setValue("frequencyInterval", preset.interval, { shouldDirty: true, shouldValidate: true });
              }}
            />
          ))}
        </Stack>
      </Box>
      {showActive && (
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  disabled={disabled}
                />
              }
              label={field.value ? "Aktiv" : "Inaktiv"}
            />
          )}
        />
      )}
    </Stack>
  );
}
