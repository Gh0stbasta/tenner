/** Add or edit a household member: name and color (HOUSEHOLD-ADMIN-001); "without login" on creation (HOUSEHOLD-ADMIN-006). */

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { MEMBER_COLORS, MEMBER_COLOR_LABELS, MEMBER_COLOR_VALUES, type MemberColor } from "../../types/domain";
import { useCreateMember, useUpdateMember, type Member } from "./api";

export const DISPLAY_NAME_MAX = 40;

export interface MemberDialogProps {
  /** Edit this member; null adds a new one. */
  readonly member: Member | null;
  readonly onClose: () => void;
}

export function ColorSwatch({ color }: { readonly color: MemberColor }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-block",
        width: 14,
        height: 14,
        borderRadius: "50%",
        bgcolor: MEMBER_COLOR_VALUES[color],
        flexShrink: 0,
      }}
    />
  );
}

/** Mounted per opening (keyed by the caller), so fields start from the member's values. */
export function MemberDialog({ member, onClose }: MemberDialogProps) {
  const titleId = useId();
  const notify = useNotify();
  const create = useCreateMember();
  const update = useUpdateMember();
  const [displayName, setDisplayName] = useState(member?.displayName ?? "");
  const [color, setColor] = useState<MemberColor>(member?.color ?? "GREEN");
  const [withoutLogin, setWithoutLogin] = useState(false);
  const name = displayName.trim();
  const tooLong = name.length > DISPLAY_NAME_MAX;
  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;

  const submit = () => {
    const onSuccess = (saved: Member) => {
      notify({ message: member ? `„${saved.displayName}“ gespeichert.` : `„${saved.displayName}“ hinzugefügt.` });
      onClose();
    };
    if (member) update.mutate({ userId: member.userId, changes: { displayName: name, color } }, { onSuccess });
    else create.mutate({ displayName: name, color, ...(withoutLogin ? { canSignIn: false } : {}) }, { onSuccess });
  };

  return (
    <Dialog open onClose={pending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogTitle id={titleId}>{member ? "Mitglied bearbeiten" : "Mitglied hinzufügen"}</DialogTitle>
        <DialogContent>
          {failure && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Speichern fehlgeschlagen. {errorMessage(failure)}
            </Alert>
          )}
          <TextField
            label="Name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            autoFocus
            fullWidth
            error={tooLong}
            helperText={
              tooLong
                ? `Höchstens ${DISPLAY_NAME_MAX} Zeichen.`
                : member
                  ? `ID: ${member.userId} (unveränderlich)`
                  : undefined
            }
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            select
            label="Farbe"
            value={color}
            onChange={(event) => setColor(event.target.value as MemberColor)}
            fullWidth
          >
            {MEMBER_COLORS.map((option) => (
              <MenuItem key={option} value={option}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ColorSwatch color={option} />
                  {MEMBER_COLOR_LABELS[option]}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          {member === null && (
            <>
              <FormControlLabel
                sx={{ mt: 2 }}
                control={<Switch checked={withoutLogin} onChange={(event) => setWithoutLogin(event.target.checked)} />}
                label="Ohne Anmeldung (z. B. Haushaltshilfe)"
              />
              <Box component="p" sx={{ m: 0, color: "text.secondary", typography: "body2" }}>
                Bekommt Aufgaben zugewiesen, meldet sich aber nie an. Niemand kann diesen Platz übernehmen. Später nicht
                änderbar.
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={name === "" || tooLong || pending}>
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
