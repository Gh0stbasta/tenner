/** Edit Tenner dialog (FRONTEND-005): shared form, read-only state, unsaved-changes protection. */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { formatShortDate } from "../../utils/format";
import { useUpdateTenner, type TennerUpdate } from "./api";
import { applyServerErrors } from "./applyServerErrors";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import type { Tenner } from "./schemas";
import { TennerForm } from "./TennerForm";
import { assignmentForApi, tennerFormSchema, weekdaysForApi, type TennerFormValues } from "./tennerForm.schema";
import { useAssignees } from "../members/useAssignees";

export interface EditTennerDialogProps {
  /** The Tenner to edit; null closes the dialog. */
  readonly tenner: Tenner | null;
  readonly onClose: () => void;
}

const FIELDS = [
  "title",
  "category",
  "assignedTo",
  "estimatedMinutes",
  "frequencyInterval",
  "frequencyUnit",
  "weekdays",
  "active",
] as const;

function toFormValues(tenner: Tenner): TennerFormValues {
  const { title, category, assignedTo, estimatedMinutes, frequencyUnit, frequencyInterval, active } = tenner;
  return {
    title,
    category,
    assignedTo,
    estimatedMinutes,
    frequencyUnit,
    frequencyInterval,
    weekdays: [...(tenner.weekdays ?? [])],
    rotating: tenner.assignmentMode === "ROTATING",
    rotation: [...(tenner.rotation ?? [])],
    active,
  };
}

function formatTimestamp(value: string | null): string {
  if (value === null) return "Noch nie";
  return new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function ReadOnlyFacts({ tenner }: { readonly tenner: Tenner }) {
  const facts: [string, string][] = [
    ["Tenner-ID", tenner.tennerId],
    ["Erstellt", formatTimestamp(tenner.createdAt)],
    ["Zuletzt erledigt", formatTimestamp(tenner.lastCompleted)],
    ["Nächste Fälligkeit", formatShortDate(tenner.nextDue)],
  ];
  return (
    <Box
      component="dl"
      sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5, mt: 3, mb: 0 }}
    >
      {facts.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Mounted per Tenner (keyed), so the form starts from that Tenner's values. */
function EditTennerForm({ tenner, onClose }: { readonly tenner: Tenner; readonly onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const notify = useNotify();
  const update = useUpdateTenner();
  const memberOrder = useAssignees().map((member) => member.userId);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const form = useForm<TennerFormValues>({
    resolver: zodResolver(tennerFormSchema),
    mode: "onChange",
    defaultValues: toFormValues(tenner),
  });
  const { isDirty, isValid, dirtyFields } = form.formState;

  const requestClose = () => {
    if (update.isPending) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = form.handleSubmit((values) => {
    // Send only the changed fields (partial update, TICKET-011).
    const changes: Record<string, unknown> = {};
    for (const field of FIELDS) {
      if (dirtyFields[field]) changes[field] = values[field];
    }
    // The API needs unit, interval and weekdays together (SCHEDULING-001/002), so the frequency is sent as a group.
    if (dirtyFields.frequencyUnit || dirtyFields.frequencyInterval || dirtyFields.weekdays) {
      changes.frequencyUnit = values.frequencyUnit;
      changes.frequencyInterval = values.frequencyInterval;
      changes.weekdays = weekdaysForApi(values);
    }
    // Mode, rotation and assignee belong together (HOUSEHOLD-001).
    if (dirtyFields.rotating || dirtyFields.rotation) {
      Object.assign(changes, assignmentForApi(values, memberOrder));
      changes.assignedTo = values.assignedTo;
    }
    update.mutate(
      { tennerId: tenner.tennerId, update: changes as TennerUpdate },
      {
        onSuccess: () => {
          notify({ message: "✅ Tenner aktualisiert." });
          onClose();
        },
        onError: (error) => applyServerErrors(error, FIELDS, form.setError),
      },
    );
  });

  return (
    <>
      <Dialog open onClose={requestClose} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby={titleId}>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <DialogTitle id={titleId}>Tenner bearbeiten</DialogTitle>
          <DialogContent>
            {update.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Änderungen konnten nicht gespeichert werden. {errorMessage(update.error)}
              </Alert>
            )}
            <TennerForm form={form} showActive disabled={update.isPending} />
            <ReadOnlyFacts tenner={tenner} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={requestClose} disabled={update.isPending}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={!isValid || !isDirty || update.isPending}>
              Änderungen speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <DiscardChangesDialog
        open={confirmDiscard}
        onDiscard={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onContinue={() => setConfirmDiscard(false)}
      />
    </>
  );
}

export function EditTennerDialog({ tenner, onClose }: EditTennerDialogProps) {
  if (!tenner) return null;
  return <EditTennerForm key={tenner.tennerId} tenner={tenner} onClose={onClose} />;
}
