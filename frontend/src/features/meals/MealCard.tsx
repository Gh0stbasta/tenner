/** One meal of the plan (FOOD-009): dish, time, vegetarian hint, empty reason and soft rule hints. */

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { PlanSlot, Violation } from "./api";
import { DishImage } from "./DishImage";
import { dishDetails } from "./format";
import { MEAL_SLOT_LABELS } from "./labels";

export interface MealCardProps {
  readonly slot: PlanSlot;
  readonly hints: readonly Violation[];
  /** Actions of later tickets (replace, choose, lock …). */
  readonly actions?: ReactNode;
  /** Below the dish, e.g. what was eaten (FOOD-023). */
  readonly footer?: ReactNode;
}

export function MealCard({ slot, hints, actions, footer }: MealCardProps) {
  const label = MEAL_SLOT_LABELS[slot.slot];
  return (
    <Box
      role="group"
      aria-label={`${label}: ${slot.dish?.name ?? "nichts geplant"}`}
      sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1 }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ width: 52, flexShrink: 0, lineHeight: 2 }}>
        {label}
      </Typography>
      {slot.dish && (
        <DishImage
          name={slot.dish.name}
          category={slot.dish.category}
          imageKey={slot.dish.imageKey}
          width={56}
          height={56}
        />
      )}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {slot.dish ? (
          <>
            <Typography variant="body1" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}>
              {slot.dish.name}
              {slot.dish.favorite && (
                <span role="img" aria-label="Favorit" title="Favorit">
                  ⭐
                </span>
              )}
              {slot.locked && <LockOutlinedIcon fontSize="inherit" aria-label="Festgelegt" titleAccess="Festgelegt" />}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dishDetails(slot)}
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body1" color="text.secondary">
              Nichts geplant
            </Typography>
            {slot.emptyReason && (
              <Typography variant="body2" color="text.secondary">
                {slot.emptyReason}
              </Typography>
            )}
          </>
        )}
        {hints.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
            {hints.map((hint) => (
              <Chip
                key={`${hint.rule}-${hint.message}`}
                size="small"
                color={hint.severity === "HARD" ? "error" : "warning"}
                variant="outlined"
                label={hint.message}
              />
            ))}
          </Stack>
        )}
        {footer}
      </Box>
      {actions}
    </Box>
  );
}
