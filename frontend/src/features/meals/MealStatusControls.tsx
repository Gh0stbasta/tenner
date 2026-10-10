/**
 * What was really eaten (FOOD-023): for today's and past meals „Gekocht“, „Ausgefallen“ or „Anderes gegessen“, and
 * for a cooked meal 👍 / 👎 (one per household, last one wins). The planner uses it for favorites and repeats.
 */

import { Box, Chip, IconButton, Tooltip } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useSetMealStatus, type PlanSlot, type WeekChoice } from "./api";

const STATUSES = [
  { status: "COOKED", label: "Gekocht" },
  { status: "SKIPPED", label: "Ausgefallen" },
  { status: "OTHER", label: "Anderes gegessen" },
] as const;

export function MealStatusControls({
  slot,
  week,
  disabled,
}: {
  readonly slot: PlanSlot;
  readonly week: WeekChoice;
  readonly disabled: boolean;
}) {
  const notify = useNotify();
  const change = useSetMealStatus(week);
  const set = (status: PlanSlot["status"], feedback?: "UP" | "DOWN") =>
    change.mutate(
      { slotId: slot.slotId, status, ...(feedback ? { feedback } : {}) },
      { onError: (error) => notify({ severity: "error", message: `Nicht gespeichert. ${errorMessage(error)}` }) },
    );
  const busy = disabled || change.isPending;
  return (
    <Box
      role="group"
      aria-label={`Wie war ${slot.dish?.name ?? "das Essen"}?`}
      sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center", mt: 0.5 }}
    >
      {STATUSES.map(({ status, label }) => (
        <Chip
          key={status}
          size="small"
          label={label}
          color={slot.status === status ? "primary" : "default"}
          variant={slot.status === status ? "filled" : "outlined"}
          aria-pressed={slot.status === status}
          onClick={busy ? undefined : () => set(slot.status === status ? "PLANNED" : status)}
          disabled={busy}
        />
      ))}
      {slot.status === "COOKED" && (
        <>
          <Tooltip title="Hat geschmeckt">
            <span>
              <IconButton
                size="small"
                aria-label="Hat geschmeckt"
                aria-pressed={slot.feedback === "UP"}
                disabled={busy}
                onClick={() => set("COOKED", slot.feedback === "UP" ? undefined : "UP")}
                sx={{ opacity: slot.feedback === "UP" ? 1 : 0.5 }}
              >
                <span aria-hidden="true">👍</span>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Lieber nicht wieder">
            <span>
              <IconButton
                size="small"
                aria-label="Lieber nicht wieder"
                aria-pressed={slot.feedback === "DOWN"}
                disabled={busy}
                onClick={() => set("COOKED", slot.feedback === "DOWN" ? undefined : "DOWN")}
                sx={{ opacity: slot.feedback === "DOWN" ? 1 : 0.5 }}
              >
                <span aria-hidden="true">👎</span>
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
