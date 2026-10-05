import { Box, Typography } from "@mui/material";
import { formatDaysAgo, formatMinutes, formatShortDate } from "../../utils/format";
import { daysBetween, todayIsoDate } from "../../utils/dates";
import { formatDueIn, formatOverdue } from "../../utils/format";
import { useHouseholdTimezone } from "../household/api";
import { frequencyLabel } from "../tenners/status";
import type { Tenner } from "../tenners/schemas";

function lastCompletedLabel(timestamp: string, timeZone: string | undefined): string {
  const date = new Date(timestamp);
  const label = date.toLocaleDateString("de-DE", { dateStyle: "medium", ...(timeZone ? { timeZone } : {}) });
  return `${label} (${formatDaysAgo(daysBetween(todayIsoDate(date, timeZone), todayIsoDate(new Date(), timeZone)))})`;
}

function relativeDue(nextDue: string, timeZone: string | undefined): string {
  const days = daysBetween(todayIsoDate(new Date(), timeZone), nextDue);
  return days < 0 ? formatOverdue(-days) : formatDueIn(days);
}

/** Frequency, last completion, next due date and duration (FRONTEND-009). */
export function ScheduleSummary({ tenner }: { readonly tenner: Tenner }) {
  const timeZone = useHouseholdTimezone();
  const rows: [string, string][] = [
    ["Häufigkeit", frequencyLabel(tenner)],
    [
      "Zuletzt erledigt",
      tenner.lastCompleted === null ? "Noch nie" : lastCompletedLabel(tenner.lastCompleted, timeZone),
    ],
    ["Nächste Fälligkeit", `${formatShortDate(tenner.nextDue)} (${relativeDue(tenner.nextDue, timeZone)})`],
    ["Geschätzte Dauer", formatMinutes(tenner.estimatedMinutes)],
  ];
  return (
    <Box
      component="dl"
      sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" }, columnGap: 3, rowGap: 1, m: 0 }}
    >
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="body1" sx={{ m: 0, mb: { xs: 1, sm: 0 } }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
