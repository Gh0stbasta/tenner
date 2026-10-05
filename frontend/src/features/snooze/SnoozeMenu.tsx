/** "Verschieben" action with quick options and a date picker (SCHEDULING-003). */

import SnoozeIcon from "@mui/icons-material/Snooze";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { formatShortDate } from "../../utils/format";
import { useToday } from "../household/api";
import { useSnoozeTenner } from "./api";
import { addDaysIso, snoozeOptions, type SnoozeRequest } from "./snoozeOptions";

export interface SnoozeMenuProps {
  readonly tenner: { readonly tennerId: string; readonly title: string };
  /** "icon" for compact cards (dashboard), "button" for page headers. */
  readonly variant?: "icon" | "button";
  readonly disabled?: boolean;
}

export function SnoozeMenu({ tenner, variant = "button", disabled = false }: SnoozeMenuProps) {
  const menuId = useId();
  const dialogTitleId = useId();
  const today = useToday();
  const notify = useNotify();
  const snooze = useSnoozeTenner();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [picking, setPicking] = useState(false);
  const tomorrow = addDaysIso(today, 1);
  const [date, setDate] = useState("");

  const label = `„${tenner.title}“ verschieben`;
  const busy = disabled || snooze.isPending;

  const submit = (request: SnoozeRequest) => {
    setAnchor(null);
    snooze.mutate(
      { tennerId: tenner.tennerId, request },
      {
        onSuccess: (response) => {
          setPicking(false);
          notify({ message: `⏰ „${tenner.title}“ auf ${formatShortDate(response.snooze.snoozedUntil)} verschoben.` });
        },
        onError: (error) =>
          notify({ message: `Verschieben fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      },
    );
  };

  const openPicker = () => {
    setAnchor(null);
    setDate(tomorrow);
    setPicking(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title="Verschieben">
          <span>
            <IconButton
              aria-label={label}
              aria-haspopup="menu"
              aria-controls={anchor ? menuId : undefined}
              onClick={(event) => setAnchor(event.currentTarget)}
              disabled={busy}
            >
              <SnoozeIcon />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button
          startIcon={<SnoozeIcon />}
          aria-label={label}
          aria-haspopup="menu"
          aria-controls={anchor ? menuId : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
          disabled={busy}
        >
          Verschieben
        </Button>
      )}
      <Menu id={menuId} anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {snoozeOptions(today).map((option) => (
          <MenuItem key={option.key} onClick={() => submit(option.request)}>
            {option.label}
          </MenuItem>
        ))}
        <MenuItem onClick={openPicker}>Datum wählen …</MenuItem>
      </Menu>
      <Dialog open={picking} onClose={() => setPicking(false)} aria-labelledby={dialogTitleId} fullWidth maxWidth="xs">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit({ until: date });
          }}
        >
          <DialogTitle id={dialogTitleId}>„{tenner.title}“ verschieben</DialogTitle>
          <DialogContent>
            <TextField
              label="Neues Fälligkeitsdatum"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              fullWidth
              sx={{ mt: 1 }}
              helperText="Höchstens eine Wiederholung bzw. 30 Tage in die Zukunft."
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: tomorrow } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPicking(false)}>Abbrechen</Button>
            <Button type="submit" variant="contained" disabled={date < tomorrow || snooze.isPending}>
              Verschieben
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
