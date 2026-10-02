/** Create Tenner dialog (FRONTEND-004). Full screen on phones. */

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useCurrentUser } from "../completions/CurrentUserProvider";
import { useCreateTenner } from "./api";
import { applyServerErrors } from "./applyServerErrors";
import { TennerForm } from "./TennerForm";
import { tennerFormSchema, type TennerFormValues } from "./tennerForm.schema";

export interface CreateTennerDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const FIELDS = ["title", "category", "assignedTo", "estimatedMinutes", "frequencyDays"] as const;

export function CreateTennerDialog({ open, onClose }: CreateTennerDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const notify = useNotify();
  const currentUser = useCurrentUser();
  const create = useCreateTenner();

  const form = useForm<TennerFormValues>({
    resolver: zodResolver(tennerFormSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      category: "HOUSEHOLD",
      assignedTo: currentUser,
      estimatedMinutes: 10,
      frequencyDays: 14,
      active: true,
    },
  });

  const close = () => {
    if (create.isPending) return;
    form.reset();
    create.reset();
    onClose();
  };

  const submit = form.handleSubmit((values) => {
    const { title, category, assignedTo, estimatedMinutes, frequencyDays } = values;
    create.mutate(
      { title, category, assignedTo, estimatedMinutes, frequencyDays },
      {
        onSuccess: (created) => {
          notify({ message: `✅ „${created.title}“ angelegt.` });
          form.reset();
          create.reset();
          onClose();
        },
        onError: (error) => applyServerErrors(error, FIELDS, form.setError),
      },
    );
  });

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <DialogTitle id={titleId}>Tenner anlegen</DialogTitle>
        <DialogContent>
          {create.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Tenner konnte nicht angelegt werden. {errorMessage(create.error)}
            </Alert>
          )}
          <TennerForm form={form} disabled={create.isPending} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={create.isPending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={!form.formState.isValid || create.isPending}>
            Tenner anlegen
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
