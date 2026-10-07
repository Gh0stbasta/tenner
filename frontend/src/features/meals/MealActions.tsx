/** Menu of one meal (FOOD-007; FOOD-022 and FOOD-008 add entries). */

import MoreVertIcon from "@mui/icons-material/MoreVert";
import { IconButton, ListItemText, Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export interface MealAction {
  readonly label: string;
  readonly onClick: () => void;
}

export function MealActions({
  label,
  actions,
  disabled,
}: {
  readonly label: string;
  readonly actions: readonly MealAction[];
  readonly disabled: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        aria-label={`Aktionen: ${label}`}
        onClick={(event) => setAnchor(event.currentTarget)}
        disabled={disabled}
        size="small"
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            onClick={() => {
              setAnchor(null);
              action.onClick();
            }}
          >
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
