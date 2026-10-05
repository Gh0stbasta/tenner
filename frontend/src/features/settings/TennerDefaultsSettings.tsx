/**
 * Household defaults for new Tenners (HOUSEHOLD-ADMIN-003): category, minutes and frequency for Quick Add and the
 * create dialog, shared by all members. Offers once to move defaults that this device stored before.
 */

import { Alert, Button, MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useCategoryName } from "../categories/api";
import { useCategoryOptions } from "../categories/useCategoryOptions";
import { useHousehold, useUpdateHousehold, type HouseholdTennerDefaults } from "../household/api";
import { NumberSetting } from "./NumberSetting";
import {
  FREQUENCY_RANGE,
  loadLegacyTennerDefaults,
  loadPreferences,
  MINUTES_RANGE,
  savePreferences,
} from "./preferences";
import { SettingsSection } from "./SettingsSection";

/** Offer to upload this device's old Quick Add defaults while the household still uses the built-in ones. */
function LegacyDefaultsOffer({
  onAccept,
  busy,
}: {
  readonly onAccept: (defaults: HouseholdTennerDefaults) => void;
  readonly busy: boolean;
}) {
  const categoryName = useCategoryName();
  const [legacy, setLegacy] = useState(() => loadLegacyTennerDefaults());
  if (!legacy) return null;
  const dismiss = () => {
    savePreferences(loadPreferences()); // rewrites the stored envelope without the old fields
    setLegacy(null);
  };
  return (
    <Alert
      severity="info"
      sx={{ mb: 2 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button
            color="inherit"
            size="small"
            disabled={busy}
            onClick={() => {
              onAccept(legacy);
              dismiss();
            }}
          >
            Übernehmen
          </Button>
          <Button color="inherit" size="small" disabled={busy} onClick={dismiss}>
            Verwerfen
          </Button>
        </Stack>
      }
    >
      Auf diesem Gerät sind eigene Standardwerte gespeichert ({categoryName(legacy.category)}, {legacy.estimatedMinutes}{" "}
      Min., alle {legacy.frequencyDays} Tage). Für den ganzen Haushalt übernehmen?
    </Alert>
  );
}

export function TennerDefaultsSettings() {
  const household = useHousehold();
  const update = useUpdateHousehold();
  const notify = useNotify();
  const defaults = household.data?.defaults;
  const categoryOptions = useCategoryOptions(defaults?.category);
  const save = (changes: Partial<HouseholdTennerDefaults>) => {
    if (!defaults) return;
    update.mutate(
      { defaults: { ...defaults, ...changes } },
      {
        onError: (error) => notify({ message: `Speichern fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      },
    );
  };

  return (
    <SettingsSection
      title="Standardwerte für neue Tenner"
      description="Gilt für „Schnell anlegen“ und den Dialog „Neuer Tenner“ – für alle im Haushalt."
    >
      {household.isSuccess && household.data.defaultsSource === "DEFAULT" && (
        <LegacyDefaultsOffer
          busy={update.isPending}
          onAccept={(legacy) =>
            update.mutate({ defaults: legacy }, { onSuccess: () => notify({ message: "Standardwerte übernommen." }) })
          }
        />
      )}
      {household.isError && (
        <Alert severity="error">Standardwerte konnten nicht geladen werden. {errorMessage(household.error)}</Alert>
      )}
      {defaults && (
        <Stack spacing={2}>
          <TextField
            select
            label="Kategorie"
            value={defaults.category}
            onChange={(event) => save({ category: event.target.value })}
            fullWidth
          >
            {categoryOptions.map((category) => (
              <MenuItem key={category.categoryId} value={category.categoryId} disabled={category.archived === true}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <NumberSetting
            label="Geschätzte Dauer (Minuten)"
            value={defaults.estimatedMinutes}
            range={MINUTES_RANGE}
            onSave={(estimatedMinutes) => save({ estimatedMinutes })}
          />
          <NumberSetting
            label="Häufigkeit (alle … Tage)"
            value={defaults.frequencyDays}
            range={FREQUENCY_RANGE}
            onSave={(frequencyDays) => save({ frequencyDays })}
          />
        </Stack>
      )}
    </SettingsSection>
  );
}
