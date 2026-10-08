/**
 * „Heute erledigen wir“ (UI-001): today's Aufgaben as a checklist. Aufgaben completed today come first, ticked; the
 * open ones (due today, or still overdue before the notifier moved them, REC-001) keep the dashboard card with its
 * complete button, swipe, snooze and skip (FRONTEND-007, MOBILE-005, SCHEDULING-003/004).
 */

import { Box, Card, CardContent, Checkbox, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useId } from "react";
import { useRecentActivity } from "../completions/useRecentActivity";
import { useToday } from "../household/api";
import { useMemberName } from "../members/api";
import type { DashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";

/** YYYY-MM-DD of a UTC timestamp in the device's local time (the household's timezone in practice). */
const localDateOf = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function TodayTasksCard({ open }: { readonly open: readonly DashboardTenner[] }) {
  const headingId = useId();
  const today = useToday();
  const memberName = useMemberName();
  const activity = useRecentActivity();
  const done = (activity.data?.items ?? []).filter(
    (item) => item.revertedAt === null && localDateOf(item.completedAt) === today,
  );
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h2" id={headingId} sx={{ fontSize: "1.2rem", mb: 1 }}>
          Heute erledigen wir
        </Typography>
        {open.length === 0 && done.length === 0 && <Typography color="text.secondary">Heute steht nichts an.</Typography>}
        {done.length > 0 && (
          <List disablePadding aria-label="Heute erledigt">
            {done.map((item) => (
              <ListItem key={item.completionId} disableGutters sx={{ py: 0 }}>
                <Checkbox checked disabled slotProps={{ input: { "aria-label": `${item.tennerTitle ?? "Aufgabe"} (erledigt)` } }} />
                <ListItemText
                  primary={item.tennerTitle ?? "Gelöschte Aufgabe"}
                  secondary={memberName(item.completedBy)}
                  slotProps={{ primary: { sx: { textDecoration: "line-through", color: "text.secondary" } } }}
                />
              </ListItem>
            ))}
          </List>
        )}
        {open.length > 0 && (
          <Box component="ul" aria-label="Offen heute" sx={{ p: 0, m: 0, mt: done.length > 0 ? 1 : 0, display: "grid", gap: 1.5 }}>
            {open.map((tenner) => (
              <DashboardTennerCard key={tenner.tennerId} tenner={tenner} variant="dueToday" completable />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
