/** "Zuletzt erledigt" (FRONTEND-007): the last 10 completions, newest first. */

import { Card, CardContent, List, Typography } from "@mui/material";
import { useId } from "react";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SectionLoading } from "../../components/LoadingState";
import { ActivityCard } from "./ActivityCard";
import { useRecentActivity } from "./useRecentActivity";

export function RecentActivityWidget() {
  const activity = useRecentActivity();
  const headingId = useId();
  const now = new Date();

  return (
    <Card component="section" aria-labelledby={headingId} sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h2" id={headingId} sx={{ fontSize: "1.05rem" }}>
          Zuletzt erledigt
        </Typography>
        {activity.isPending ? (
          <SectionLoading label="Aktivität wird geladen" />
        ) : activity.isError ? (
          <ErrorAlert
            title="Aktivität nicht verfügbar"
            message="Bitte versuche es erneut."
            onRetry={() => void activity.refetch()}
          />
        ) : activity.data.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Noch nichts erledigt.
          </Typography>
        ) : (
          <List dense disablePadding aria-label="Letzte Erledigungen">
            {activity.data.items.map((item) => (
              <ActivityCard key={item.completionId} item={item} now={now} />
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
