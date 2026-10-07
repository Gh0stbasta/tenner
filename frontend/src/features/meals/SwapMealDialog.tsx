/** „Tauschen“ (FOOD-022): choose the other meal of the week; past meals cannot be changed. */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useId } from "react";
import { formatShortDate } from "../../utils/format";
import type { MealPlan, PlanSlot } from "./api";
import { MEAL_SLOT_LABELS } from "./labels";

export function SwapMealDialog({
  plan,
  slot,
  today,
  onPick,
  onClose,
}: {
  readonly plan: MealPlan;
  /** The meal to swap; null = closed. */
  readonly slot: PlanSlot | null;
  readonly today: string;
  readonly onPick: (target: PlanSlot) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const targets = slot
    ? plan.slots.filter((candidate) => candidate.slotId !== slot.slotId && candidate.date >= today)
    : [];
  return (
    <Dialog open={slot !== null} onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>
        {slot ? `${slot.dish?.name ?? "Nichts geplant"} tauschen mit …` : "Tauschen"}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List dense aria-label="Mahlzeiten der Woche">
          {targets.map((target) => (
            <ListItemButton key={target.slotId} onClick={() => onPick(target)}>
              <ListItemText
                primary={`${formatShortDate(target.date)} ${MEAL_SLOT_LABELS[target.slot]}`}
                secondary={target.dish?.name ?? "Nichts geplant"}
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
