/**
 * Temporary handover (HOUSEHOLD-004): a member's Tenners go to another member until a date and come back
 * automatically. Shows a preview of how many Tenners move.
 */

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import type { Category } from "../../types/domain";
import { formatShortDate, formatTennerCount } from "../../utils/format";
import { useCategoryName, useSelectableCategories } from "../categories/api";
import { useHandovers, useStartHandover, useToday } from "../household/api";
import { useActiveMembers, useAssignedTennerCategories, type Member } from "./api";

export interface HandoverDialogProps {
  readonly member: Member;
  readonly onClose: () => void;
}

export function HandoverDialog({ member, onClose }: HandoverDialogProps) {
  const titleId = useId();
  const groupId = useId();
  const notify = useNotify();
  const today = useToday();
  const start = useStartHandover();
  const categoryName = useCategoryName();
  const allCategories = useSelectableCategories().map((category) => category.categoryId);
  const assigned = useAssignedTennerCategories(member.userId);
  // Members who hand over their own Tenners right now cannot cover.
  const away = useHandovers().map((handover) => handover.from);
  const candidates = useActiveMembers().filter(
    (candidate) => candidate.userId !== member.userId && !away.includes(candidate.userId),
  );
  const [to, setTo] = useState(candidates[0]?.userId ?? "");
  const [until, setUntil] = useState("");
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const target = candidates.find((candidate) => candidate.userId === to) ?? candidates[0];
  const inPast = until !== "" && until < today;
  const moving = (assigned.data ?? []).filter((category) => categories.length === 0 || categories.includes(category));

  const toggle = (category: Category) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  const submit = () => {
    if (!target) return;
    start.mutate(
      {
        from: member.userId,
        to: target.userId,
        until,
        ...(categories.length > 0 ? { categories: allCategories.filter((c) => categories.includes(c)) } : {}),
      },
      {
        onSuccess: (result) => {
          notify({ message: `${formatTennerCount(result.handedOver)} an ${target.displayName} übergeben.` });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onClose={start.isPending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>Aufgaben von {member.displayName} übergeben</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Zum Beispiel bei Dienstreise oder Krankheit. Nach dem letzten Tag kommen die Aufgaben automatisch zurück.
        </DialogContentText>
        {start.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Übergabe fehlgeschlagen. {errorMessage(start.error)}
          </Alert>
        )}
        {candidates.length === 0 ? (
          <Alert severity="info">Es gibt niemanden, der gerade übernehmen kann.</Alert>
        ) : (
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              select
              label="Übernimmt"
              value={target?.userId ?? ""}
              onChange={(event) => setTo(event.target.value)}
              fullWidth
            >
              {candidates.map((candidate) => (
                <MenuItem key={candidate.userId} value={candidate.userId}>
                  {candidate.displayName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bis einschließlich"
              type="date"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
              error={inPast}
              helperText={inPast ? "Liegt in der Vergangenheit." : undefined}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
            />
            <Box>
              <Typography variant="body2" color="text.secondary" id={groupId} sx={{ mb: 1 }}>
                Kategorien (ohne Auswahl: alle)
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
                role="group"
                aria-labelledby={groupId}
              >
                {allCategories.map((category) => (
                  <Chip
                    key={category}
                    label={categoryName(category)}
                    color={categories.includes(category) ? "primary" : "default"}
                    variant={categories.includes(category) ? "filled" : "outlined"}
                    aria-pressed={categories.includes(category)}
                    onClick={() => toggle(category)}
                  />
                ))}
              </Stack>
            </Box>
            {assigned.isError ? (
              <Alert severity="error">Zugeordnete Aufgaben konnten nicht geladen werden.</Alert>
            ) : (
              <Alert severity="info" role="status">
                {assigned.isPending
                  ? "Aufgaben werden gezählt …"
                  : `${formatTennerCount(moving.length)} ${moving.length === 1 ? "geht" : "gehen"}${
                      until === "" ? "" : ` bis ${formatShortDate(until)}`
                    } an ${target?.displayName ?? ""}.`}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={start.isPending}>
          Abbrechen
        </Button>
        <Button variant="contained" onClick={submit} disabled={start.isPending || !target || until === "" || inPast}>
          Übergeben
        </Button>
      </DialogActions>
    </Dialog>
  );
}
