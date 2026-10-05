/** Deactivate a member: reassign their Tenners, then confirm (HOUSEHOLD-ADMIN-004). */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useActiveMembers, useAssignedTennerCount, useDeactivateMember, type Member } from "./api";

export interface DeactivateMemberDialogProps {
  readonly member: Member;
  readonly onClose: () => void;
}

export function DeactivateMemberDialog({ member, onClose }: DeactivateMemberDialogProps) {
  const titleId = useId();
  const notify = useNotify();
  const deactivate = useDeactivateMember();
  const count = useAssignedTennerCount(member.userId);
  const others = useActiveMembers().filter((candidate) => candidate.userId !== member.userId);
  const [reassignTo, setReassignTo] = useState(others[0]?.userId ?? "");
  const target = others.find((candidate) => candidate.userId === reassignTo) ?? others[0];
  const needsTarget = (count.data ?? 0) > 0;

  const submit = () =>
    deactivate.mutate(
      { userId: member.userId, reassignTo: needsTarget && target ? target.userId : null },
      {
        onSuccess: (result) => {
          const moved =
            result.reassigned > 0 && target ? ` ${result.reassigned} Tenner an ${target.displayName} übertragen.` : "";
          notify({ message: `${member.displayName} deaktiviert.${moved}` });
          onClose();
        },
      },
    );

  return (
    <Dialog open onClose={deactivate.isPending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{member.displayName} deaktivieren?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Der Verlauf bleibt erhalten. {member.displayName} kann danach keine Tenner mehr übernehmen oder erledigen, und
          angemeldete Konten verlieren den Zugriff.
        </DialogContentText>
        {deactivate.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Deaktivieren fehlgeschlagen. {errorMessage(deactivate.error)}
          </Alert>
        )}
        {count.isPending ? (
          <DialogContentText>Zugeordnete Tenner werden geladen …</DialogContentText>
        ) : count.isError ? (
          <Alert severity="error">Zugeordnete Tenner konnten nicht geladen werden.</Alert>
        ) : needsTarget ? (
          <TextField
            select
            label={`${count.data} Tenner übertragen an`}
            value={target?.userId ?? ""}
            onChange={(event) => setReassignTo(event.target.value)}
            fullWidth
          >
            {others.map((candidate) => (
              <MenuItem key={candidate.userId} value={candidate.userId}>
                {candidate.displayName}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <DialogContentText>Es sind keine Tenner zugeordnet.</DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={deactivate.isPending}>
          Abbrechen
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={submit}
          disabled={deactivate.isPending || !count.isSuccess || (needsTarget && !target)}
        >
          Deaktivieren
        </Button>
      </DialogActions>
    </Dialog>
  );
}
