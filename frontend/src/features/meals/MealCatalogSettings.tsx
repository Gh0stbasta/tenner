/**
 * Dish catalog (FOOD-003): shows what the import would add (dry run) and imports the family's dishes after a
 * confirmation. Re-running is safe: dishes with an existing name are skipped and never changed.
 */

import { Alert, Box, Button } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { SettingsSection } from "../settings/SettingsSection";
import { useImportMealCatalog, useMealCatalogPreview, type MealCatalogImport } from "./api";
import { Link as RouterLink } from "react-router";
import { useState } from "react";
import { IngredientPricesDialog } from "./IngredientPricesDialog";

function summary(preview: MealCatalogImport): string {
  const parts = [`${preview.dishesCreated.length} neue Gerichte`];
  if (preview.dishesSkipped.length > 0) parts.push(`${preview.dishesSkipped.length} schon vorhanden`);
  return parts.join(" · ");
}

export function MealCatalogSettings() {
  const notify = useNotify();
  const preview = useMealCatalogPreview();
  const [prices, setPrices] = useState(false);
  const importer = useImportMealCatalog();
  const result = preview.data;
  const nothingToDo = result !== undefined && result.dishesCreated.length === 0;

  const runImport = () =>
    importer.mutate(undefined, {
      onSuccess: (imported) => {
        notify({ message: `Gerichtekatalog importiert: ${imported.dishesCreated.length} Gerichte angelegt.` });
        preview.reset();
      },
    });

  return (
    <SettingsSection
      title="Essen: Gerichtekatalog"
      description="Legt eure Lieblingsgerichte mit Zutaten, Kochzeit und vegetarischen Varianten an. Vorhandene Gerichte mit gleichem Namen bleiben unverändert."
    >
      {(preview.error ?? importer.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(preview.error ?? importer.error)}
        </Alert>
      )}
      {result && (
        <Alert severity={nothingToDo ? "success" : "info"} sx={{ mb: 2 }}>
          {nothingToDo ? "Alle Gerichte aus dem Katalog sind schon angelegt." : summary(result)}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button component={RouterLink} to="/essen/gerichte" variant="outlined">
          Gerichte verwalten
        </Button>
        <Button variant="outlined" onClick={() => setPrices(true)}>
          Preise
        </Button>
        {!result || nothingToDo ? (
          <Button variant="outlined" onClick={() => preview.mutate()} disabled={preview.isPending}>
            Katalog prüfen
          </Button>
        ) : (
          <>
            <Button variant="contained" onClick={runImport} disabled={importer.isPending}>
              Jetzt importieren
            </Button>
            <Button onClick={() => preview.reset()} disabled={importer.isPending}>
              Abbrechen
            </Button>
          </>
        )}
      </Box>
      {prices && <IngredientPricesDialog onClose={() => setPrices(false)} />}
    </SettingsSection>
  );
}
