import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Tenner } from "./schemas";

export interface DuplicateWarningDialogProps {
  readonly similar: Tenner | null;
  readonly onCreateAnyway: () => void;
  readonly onCancel: () => void;
}

export function DuplicateWarningDialog({ similar, onCreateAnyway, onCancel }: DuplicateWarningDialogProps) {
  return (
    <ConfirmDialog
      open={similar !== null}
      title="Ähnlicher Tenner vorhanden"
      message={similar ? `Es gibt bereits einen ähnlichen Tenner: „${similar.title}“.` : ""}
      confirmLabel="Trotzdem anlegen"
      onConfirm={onCreateAnyway}
      onCancel={onCancel}
    />
  );
}
