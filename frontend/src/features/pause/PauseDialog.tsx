/** Pause a Tenner until a date or until resumed (SCHEDULING-005). */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { formatShortDate } from "../../utils/format";
import { useToday } from "../household/api";
import { addDaysIso } from "../snooze/snoozeOptions";
import { usePauseTenner } from "./api";

export interface PauseDialogProps {
  /** The Tenner to pause; null closes the dialog. */
  readonly tenner: { readonly tennerId: string; readonly title: string } | null;
  readonly onClose: () => void;
}

export function PauseDialog({ tenner, onClose }: PauseDialogProps) {
  const titleId = useId();
  const notify = useNotify();
  const pause = usePauseTenner();
  const tomorrow = addDaysIso(useToday(), 1);
  const [until, setUntil] = useState("");
  const invalid = until !== "" && until < tomorrow;

  const close = () => {
    if (pause.isPending) return;
    setUntil("");
    pause.reset();
    onClose();
  };

  if (!tenner) return null;
  return (
    <Dialog open onClose={close} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          pause.mutate(
            { tennerId: tenner.tennerId, until: until === "" ? null : until },
            {
              onSuccess: (paused) => {
                notify({
                  message:
                    paused.pausedUntil === null
                      ? `⏸ „${tenner.title}“ pausiert.`
                      : `⏸ „${tenner.title}“ pausiert bis ${formatShortDate(paused.pausedUntil)}`,
                });
                setUntil("");
                pause.reset();
                onClose();
              },
            },
          );
        }}
      >
        <DialogTitle id={titleId}>„{tenner.title}“ pausieren</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Pausierte Tenner erscheinen nicht als fällig oder überfällig. Ohne Datum bleibt der Tenner pausiert, bis du
            ihn fortsetzt.
          </DialogContentText>
          {pause.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Pausieren fehlgeschlagen. {errorMessage(pause.error)}
            </Alert>
          )}
          <TextField
            label="Pausiert bis einschließlich (optional)"
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            fullWidth
            error={invalid}
            helperText={
              invalid ? "Bitte ein Datum in der Zukunft wählen." : "Danach ist der Tenner automatisch wieder aktiv."
            }
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: tomorrow } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={pause.isPending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={invalid || pause.isPending}>
            Pausieren
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
