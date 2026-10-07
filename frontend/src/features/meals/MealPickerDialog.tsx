/** „Selbst wählen“ (FOOD-022): every dish for one meal, those that fit all rules first; conflicts shown per dish. */

import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { SectionLoading } from "../../components/LoadingState";
import { useMealOptions, type MealOption, type WeekChoice } from "./api";
import { isHarmful } from "./format";

export function MealPickerDialog({
  week,
  slotId,
  label,
  onPick,
  onClose,
}: {
  readonly week: WeekChoice;
  /** The meal to choose for; null = closed. */
  readonly slotId: string | null;
  readonly label: string;
  readonly onPick: (option: MealOption) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const options = useMealOptions(week, slotId);
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("de");
  const shown = (options.data ?? []).filter((option) => option.dish.name.toLocaleLowerCase("de").includes(term));
  return (
    <Dialog open={slotId !== null} onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="sm">
      <DialogTitle id={titleId}>Gericht wählen: {label}</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Suchen"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 1 }}
        />
        {options.isPending && <SectionLoading label="Gerichte werden geladen" />}
        {options.isError && <Alert severity="error">{errorMessage(options.error)}</Alert>}
        {options.isSuccess && shown.length === 0 && <Alert severity="info">Kein Gericht gefunden.</Alert>}
        <List dense aria-label="Gerichte">
          {shown.map((option) => (
            <ListItemButton key={option.dish.dishId} onClick={() => onPick(option)}>
              <ListItemText
                primary={option.dish.name}
                secondary={
                  option.violations.length === 0 ? (
                    "Passt zu allen Regeln"
                  ) : (
                    <Stack component="span" direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                      {option.violations.map((violation) => (
                        <Chip
                          key={`${violation.rule}-${violation.message}`}
                          component="span"
                          size="small"
                          variant="outlined"
                          color={isHarmful(violation) ? "error" : violation.severity === "HARD" ? "warning" : "default"}
                          label={violation.message}
                        />
                      ))}
                    </Stack>
                  )
                }
                slotProps={{ secondary: { component: "span" } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
      </DialogActions>
    </Dialog>
  );
}
