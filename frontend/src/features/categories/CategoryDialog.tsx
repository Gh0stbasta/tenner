/** Add or edit a category: name, icon and color (HOUSEHOLD-ADMIN-002). */

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_LABELS,
  MEMBER_COLORS,
  MEMBER_COLOR_LABELS,
  type CategoryIcon as CategoryIconId,
  type MemberColor,
} from "../../types/domain";
import { ColorSwatch } from "../members/MemberDialog";
import { useCreateCategory, useUpdateCategory, type CategoryEntry } from "./api";
import { CategoryIcon } from "./CategoryIcon";

export const CATEGORY_NAME_MAX = 40;

export interface CategoryDialogProps {
  /** Edit this category; null adds a new one. */
  readonly category: CategoryEntry | null;
  readonly onClose: () => void;
}

export function CategoryDialog({ category, onClose }: CategoryDialogProps) {
  const titleId = useId();
  const notify = useNotify();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<CategoryIconId>(category?.icon ?? "STAR");
  const [color, setColor] = useState<MemberColor>(category?.color ?? "GREEN");
  const trimmed = name.trim();
  const tooLong = trimmed.length > CATEGORY_NAME_MAX;
  const pending = create.isPending || update.isPending;
  const failure = create.error ?? update.error;

  const submit = () => {
    const onSuccess = (saved: CategoryEntry) => {
      notify({
        message: category ? `Kategorie „${saved.name}“ gespeichert.` : `Kategorie „${saved.name}“ hinzugefügt.`,
      });
      onClose();
    };
    if (category)
      update.mutate({ categoryId: category.categoryId, changes: { name: trimmed, icon, color } }, { onSuccess });
    else create.mutate({ name: trimmed, icon, color }, { onSuccess });
  };

  return (
    <Dialog open onClose={pending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogTitle id={titleId}>{category ? "Kategorie bearbeiten" : "Kategorie hinzufügen"}</DialogTitle>
        <DialogContent>
          {failure && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Speichern fehlgeschlagen. {errorMessage(failure)}
            </Alert>
          )}
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
            fullWidth
            error={tooLong}
            helperText={
              tooLong
                ? `Höchstens ${CATEGORY_NAME_MAX} Zeichen.`
                : category
                  ? `ID: ${category.categoryId} (unveränderlich)`
                  : undefined
            }
            sx={{ mt: 1, mb: 2 }}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <TextField
              select
              label="Symbol"
              value={icon}
              onChange={(event) => setIcon(event.target.value as CategoryIconId)}
            >
              {CATEGORY_ICONS.map((option) => (
                <MenuItem key={option} value={option}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CategoryIcon icon={option} fontSize="small" />
                    {CATEGORY_ICON_LABELS[option]}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Farbe"
              value={color}
              onChange={(event) => setColor(event.target.value as MemberColor)}
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={trimmed === "" || tooLong || pending}>
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
