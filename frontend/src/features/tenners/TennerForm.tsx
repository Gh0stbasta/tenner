/** Shared Tenner form fields for Create and Edit (FRONTEND-004/005). */

import { Box, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { Controller, type UseFormReturn } from "react-hook-form";
import {
  FREQUENCY_UNITS,
  FREQUENCY_UNIT_LABELS,
  SHARED_ASSIGNEE,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
} from "../../types/domain";
import { useCategoryOptions } from "../categories/useCategoryOptions";
import { useAssignees } from "../members/useAssignees";
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
  const assignees = useAssignees(watch("assignedTo"), { includeShared: true });
  const members = useAssignees();
  const [rotating, rotation] = watch(["rotating", "rotation"]);
  const toggleRotationMember = (userId: string) =>
    setValue("rotation", rotation.includes(userId) ? rotation.filter((id) => id !== userId) : [...rotation, userId], {
      shouldDirty: true,
      shouldValidate: true,
    });
  const categoryOptions = useCategoryOptions(watch("category"));
  const [unit, interval, weekdays] = watch(["frequencyUnit", "frequencyInterval", "weekdays"]);
  const isPreset = (preset: (typeof FREQUENCY_PRESETS)[number]) =>
    preset.unit === unit && preset.interval === interval && (unit !== "WEEK" || weekdays.length === 0);
  const toggleWeekday = (day: Weekday) =>
    setValue("weekdays", weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day], {
      shouldDirty: true,
    });

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
              {categoryOptions.map((category) => (
                <MenuItem key={category.categoryId} value={category.categoryId} disabled={category.archived === true}>
                  {category.name}
                  {category.archived === true ? " (archiviert)" : ""}
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
              label={rotating ? "Aktuell zuständig" : "Zuständig"}
              required
              disabled={disabled}
              error={errors.assignedTo !== undefined}
              helperText={errors.assignedTo?.message}
              {...field}
            >
              {(rotating
                ? assignees.filter((member) => rotation.includes(member.userId) || member.userId === field.value)
                : assignees
              ).map((member) => (
                <MenuItem key={member.userId} value={member.userId}>
                  {member.displayName}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Box>
      <Box>
        <Controller
          control={control}
          name="rotating"
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  disabled={disabled}
                  onChange={(event) => {
                    field.onChange(event.target.checked);
                    // Start a rotation with the current assignee.
                    const current = form.getValues("assignedTo");
                    if (event.target.checked && rotation.length === 0 && current !== SHARED_ASSIGNEE)
                      setValue("rotation", [current], { shouldDirty: true });
                    void form.trigger(["rotation", "assignedTo"]);
                  }}
                />
              }
              label="Abwechselnd zuständig"
            />
          )}
        />
        {rotating && (
          <>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap", mt: 1 }}
              role="group"
              aria-label="Rotation"
            >
              {members.map((member) => (
                <Chip
                  key={member.userId}
                  label={member.displayName}
                  color={rotation.includes(member.userId) ? "primary" : "default"}
                  variant={rotation.includes(member.userId) ? "filled" : "outlined"}
                  aria-pressed={rotation.includes(member.userId)}
                  disabled={disabled}
                  onClick={() => toggleRotationMember(member.userId)}
                />
              ))}
            </Stack>
            <Typography variant="caption" color={errors.rotation ? "error" : "text.secondary"}>
              {errors.rotation?.message ??
                "Nach jeder Erledigung ist die nächste Person dran – auch wenn jemand einspringt."}
            </Typography>
          </>
        )}
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
        <TextField
          label="Startdatum"
          type="date"
          required
          disabled={disabled}
          error={errors.startDate !== undefined}
          helperText={errors.startDate?.message ?? "Vorher ist die Aufgabe nicht fällig und nicht sichtbar."}
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("startDate")}
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
                setValue("weekdays", [], { shouldDirty: true });
              }}
            />
          ))}
        </Stack>
      </Box>
      {unit === "WEEK" && (
        <Box>
          <Typography variant="body2" color="text.secondary" id="weekday-chips" sx={{ mb: 1 }}>
            An Wochentagen (optional)
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
            role="group"
            aria-labelledby="weekday-chips"
          >
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={WEEKDAY_LABELS[day]}
                color={weekdays.includes(day) ? "primary" : "default"}
                variant={weekdays.includes(day) ? "filled" : "outlined"}
                disabled={disabled}
                aria-pressed={weekdays.includes(day)}
                onClick={() => toggleWeekday(day)}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {weekdays.length > 0
              ? "Fällig am nächsten gewählten Wochentag nach der Erledigung."
              : "Ohne Auswahl: fällig eine Woche (bzw. n Wochen) nach der Erledigung."}
          </Typography>
        </Box>
      )}
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
