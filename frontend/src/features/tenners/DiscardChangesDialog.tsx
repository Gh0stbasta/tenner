import { ConfirmDialog } from "../../components/ConfirmDialog";

export interface DiscardChangesDialogProps {
  readonly open: boolean;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
}

/** Asks before closing a form with unsaved changes (FRONTEND-005). */
export function DiscardChangesDialog({ open, onDiscard, onContinue }: DiscardChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Ungespeicherte Änderungen verwerfen?"
      message="Deine Änderungen an dieser Aufgabe gehen verloren."
      confirmLabel="Verwerfen"
      cancelLabel="Weiter bearbeiten"
      destructive
      onConfirm={onDiscard}
      onCancel={onContinue}
    />
  );
}
