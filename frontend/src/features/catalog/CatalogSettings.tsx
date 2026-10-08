/**
 * Household task catalog (DATA-008): shows what the import would add (dry run) and imports it after a confirmation.
 * Re-running is safe: existing titles and members are skipped.
 */

import { Alert, Box, Button } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { SettingsSection } from "../settings/SettingsSection";
import { useCatalogPreview, useImportCatalog, type CatalogImport } from "./api";
import { formatTennerCount } from "../../utils/format";

function summary(preview: CatalogImport): string {
  const parts = [`${preview.tennersCreated.length} ${preview.tennersCreated.length === 1 ? "neue Aufgabe" : "neue Aufgaben"}`];
  if (preview.membersCreated.length > 0) parts.push(`Mitglied ${preview.membersCreated.join(", ")} (ohne Anmeldung)`);
  if (preview.tennersSkipped.length > 0) parts.push(`${preview.tennersSkipped.length} schon vorhanden`);
  return parts.join(" · ");
}

export function CatalogSettings() {
  const notify = useNotify();
  const preview = useCatalogPreview();
  const importer = useImportCatalog();
  const result = preview.data;
  const nothingToDo = result !== undefined && result.tennersCreated.length === 0 && result.membersCreated.length === 0;

  const runImport = () =>
    importer.mutate(undefined, {
      onSuccess: (imported) => {
        notify({ message: `Aufgabenkatalog importiert: ${formatTennerCount(imported.tennersCreated.length)} angelegt.` });
        preview.reset();
      },
    });

  return (
    <SettingsSection
      title="Aufgabenkatalog"
      description="Legt eure wiederkehrenden Aufgaben (täglich, wöchentlich, 12- und 26-Wochen-Rotation) und die Haushaltshilfe an. Vorhandene Aufgaben mit gleichem Titel werden übersprungen."
    >
      {(preview.error ?? importer.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(preview.error ?? importer.error)}
        </Alert>
      )}
      {result && (
        <Alert severity={nothingToDo ? "success" : "info"} sx={{ mb: 2 }}>
          {nothingToDo ? "Alles aus dem Katalog ist schon angelegt." : summary(result)}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
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
    </SettingsSection>
  );
}
