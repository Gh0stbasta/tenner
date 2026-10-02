import { Card, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { Dashboard } from "./api";

interface Metric {
  readonly label: string;
  readonly value: number;
  readonly highlight?: boolean;
}

/** Four key numbers: due today, overdue, upcoming, open minutes. */
export function SummaryCards({ summary }: { readonly summary: Dashboard["summary"] }) {
  const metrics: Metric[] = [
    { label: "Heute fällig", value: summary.dueTodayCount },
    { label: "Überfällig", value: summary.overdueCount, highlight: summary.overdueCount > 0 },
    { label: "Demnächst", value: summary.upcomingCount },
    { label: "Minuten offen", value: summary.totalActionableMinutes },
  ];
  return (
    <Grid container spacing={2} component="section" aria-label="Übersicht" sx={{ mb: 3 }}>
      {metrics.map((metric) => (
        <Grid key={metric.label} size={{ xs: 6, md: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              <Typography variant="metric" color={metric.highlight ? "error.main" : "text.primary"}>
                {metric.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
