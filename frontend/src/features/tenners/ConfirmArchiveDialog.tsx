import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Tenner } from "./schemas";

export interface ConfirmArchiveDialogProps {
  readonly tenner: Tenner | null;
  readonly busy?: boolean;
  readonly onConfirm: (tenner: Tenner) => void;
  readonly onCancel: () => void;
}

/** Confirmation before the soft delete; archived Tenners can be restored. */
export function ConfirmArchiveDialog({ tenner, busy = false, onConfirm, onCancel }: ConfirmArchiveDialogProps) {
  return (
    <ConfirmDialog
      open={tenner !== null}
      title="Tenner archivieren?"
      message={
        tenner
          ? `„${tenner.title}“ wird archiviert und erscheint nicht mehr im Dashboard. Du kannst ihn später wiederherstellen.`
          : ""
      }
      confirmLabel="Archivieren"
      destructive
      busy={busy}
      onConfirm={() => tenner && onConfirm(tenner)}
      onCancel={onCancel}
    />
  );
}
