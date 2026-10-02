import { Box, Typography } from "@mui/material";
import { formatDays } from "../../utils/format";
import type { HistoryItem } from "../completions/api";
import { computeConsistency, CONSISTENCY_WINDOW_DAYS } from "./consistency";

export interface ConsistencyIndicatorProps {
  readonly items: readonly HistoryItem[];
  readonly frequencyDays: number;
}

/** "3 Erledigungen in 90 Tagen · Ø alle 12 Tage (geplant: alle 14 Tage)". Full analytics: ANALYTICS domain. */
export function ConsistencyIndicator({ items, frequencyDays }: ConsistencyIndicatorProps) {
  const { recentCount, averageIntervalDays } = computeConsistency(items);
  const onTrack = averageIntervalDays !== undefined && averageIntervalDays <= frequencyDays * 1.1;
  return (
    <Box>
      <Typography variant="body2">
        {recentCount} {recentCount === 1 ? "Erledigung" : "Erledigungen"} in den letzten {CONSISTENCY_WINDOW_DAYS} Tagen
      </Typography>
      <Typography
        variant="body2"
        color={averageIntervalDays === undefined ? "text.secondary" : onTrack ? "secondary.main" : "warning.main"}
      >
        {averageIntervalDays === undefined
          ? "Für einen Durchschnitt braucht es mindestens zwei Erledigungen."
          : `Ø alle ${formatDays(averageIntervalDays)} (geplant: alle ${formatDays(frequencyDays)})`}
      </Typography>
    </Box>
  );
}
