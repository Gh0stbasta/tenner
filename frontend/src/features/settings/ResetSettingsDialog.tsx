/** Confirmation before all preferences are reset (FRONTEND-008). */

import { ConfirmDialog } from "../../components/ConfirmDialog";

export interface ResetSettingsDialogProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ResetSettingsDialog({ open, onConfirm, onCancel }: ResetSettingsDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Einstellungen zurücksetzen?"
      message="Alle Einstellungen auf diesem Gerät werden auf die Standardwerte zurückgesetzt."
      confirmLabel="Zurücksetzen"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
