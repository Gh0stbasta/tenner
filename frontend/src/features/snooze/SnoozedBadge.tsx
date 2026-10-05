/** "Verschoben bis …" badge (SCHEDULING-003), shown while the snooze date is still ahead or today. */

import SnoozeIcon from "@mui/icons-material/Snooze";
import { Chip } from "@mui/material";
import { formatShortDate } from "../../utils/format";
import { useToday } from "../household/api";

export function SnoozedBadge({ snoozedUntil }: { readonly snoozedUntil: string | null }) {
  const today = useToday();
  if (snoozedUntil === null || snoozedUntil < today) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      color="info"
      icon={<SnoozeIcon />}
      label={`Verschoben bis ${formatShortDate(snoozedUntil)}`}
    />
  );
}
