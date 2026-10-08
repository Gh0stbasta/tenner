/** Confirm skipping one occurrence with an optional reason (SCHEDULING-004). */

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
import { useSkipTenner } from "./api";

export const SKIP_REASON_MAX = 200;

export interface SkipDialogProps {
  readonly tenner: { readonly tennerId: string; readonly title: string };
  readonly open: boolean;
  readonly onClose: () => void;
}

export function SkipDialog({ tenner, open, onClose }: SkipDialogProps) {
  const titleId = useId();
  const notify = useNotify();
  const skip = useSkipTenner();
  const [reason, setReason] = useState("");
  const tooLong = reason.trim().length > SKIP_REASON_MAX;

  const close = () => {
    if (skip.isPending) return;
    setReason("");
    skip.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          skip.mutate(
            { tennerId: tenner.tennerId, reason },
            {
              onSuccess: (response) => {
                notify({
                  message: `⏭ „${tenner.title}“ übersprungen. Nächste Fälligkeit: ${formatShortDate(response.skip.nextDue)}`,
                });
                setReason("");
                skip.reset();
                onClose();
              },
            },
          );
        }}
      >
        <DialogTitle id={titleId}>„{tenner.title}“ diesmal überspringen?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Die Aufgabe wird nicht als erledigt gezählt und ist erst im nächsten Zyklus wieder fällig.
          </DialogContentText>
          {skip.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Überspringen fehlgeschlagen. {errorMessage(skip.error)}
            </Alert>
          )}
          <TextField
            label="Grund (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            error={tooLong}
            helperText={`${reason.trim().length}/${SKIP_REASON_MAX}`}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={skip.isPending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={tooLong || skip.isPending}>
            Überspringen
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
