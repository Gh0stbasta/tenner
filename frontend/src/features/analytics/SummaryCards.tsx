/** Completions | Minutes | On-time rate | Not done (ANALYTICS-009, REC-001; from GET /analytics/summary). */

import { Alert, Card, CardContent, Skeleton, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { errorMessage } from "../../api/errorMessages";
import { useAnalyticsSummary, isUnavailable, type PeriodSelection } from "./api";
import { formatPercent } from "./format";

export function SummaryCards({ selection }: { readonly selection: PeriodSelection }) {
  const summary = useAnalyticsSummary(selection);
  if (summary.error && isUnavailable(summary.error)) return null;
  if (summary.isError) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        Übersicht konnte nicht geladen werden. {errorMessage(summary.error)}
      </Alert>
    );
  }
  const data = summary.data;
  const metrics = [
    { label: "Erledigungen", value: data?.completions.toLocaleString("de-DE") },
    { label: "Minuten", value: data?.totalActualMinutes.toLocaleString("de-DE") },
    {
      label: "Pünktlich erledigt",
      value: data ? formatPercent(data.onTimeRate) : undefined,
      hint:
        data && data.onTimeRate === null
          ? "Noch keine Daten"
          : data
            ? `aus ${data.onTimeSamples} Erledigungen`
            : undefined,
    },
    // REC-001: Tenners no longer stay overdue; missed occurrences of the period are shown instead.
    {
      label: "Nicht erledigt",
      value: data?.missed.toLocaleString("de-DE"),
      hint: data ? "am Tag verpasst" : undefined,
    },
  ];
  return (
    <Grid container spacing={2} component="section" aria-label="Kennzahlen" sx={{ mb: 3 }}>
      {metrics.map((metric) => (
        <Grid key={metric.label} size={{ xs: 6, md: 3 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              {metric.value === undefined ? (
                <Skeleton width="60%" height={40} aria-label={`${metric.label} wird geladen`} />
              ) : (
                <Typography variant="metric">{metric.value}</Typography>
              )}
              {metric.hint && (
                <Typography variant="caption" color="text.secondary" component="p">
                  {metric.hint}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
