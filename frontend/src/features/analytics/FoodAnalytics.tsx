/**
 * Analytics tab „Essen“ (FOOD-019): what the family ate — protein sources, vegetarian share, favorites, rarely eaten
 * dishes, cost per week, variety and plan adherence. Reuses the ANALYTICS-009 chart primitives and the validated
 * categorical palette (fixed slot order, legend + table view for the stacked bar).
 */

import { Alert, Box, Card, CardContent, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { formatShortDate } from "../../utils/format";
import { FOOD_PERIODS, useFoodAnalytics, type FoodAnalytics as FoodAnalyticsData, type FoodPeriod } from "../meals/api";
import { formatEuro } from "../meals/format";
import { PROTEIN_LABELS, type ProteinTag } from "../meals/labels";
import { ChartSection } from "./ChartSection";
import { BarList, ColumnChart, DataTable, Legend, StackedBar } from "./charts";
import { useChartPalette } from "./chartColors";
import { formatPercent } from "./format";

const PERIOD_LABELS: Readonly<Record<FoodPeriod, string>> = { "4w": "4 Wochen", "12w": "12 Wochen", "1y": "1 Jahr" };

const proteinLabel = (tag: string): string =>
  tag === "NONE" ? "ohne Fleisch/Fisch" : (PROTEIN_LABELS[tag as ProteinTag] ?? tag);

const ADHERENCE = [
  { key: "asPlanned", label: "wie geplant" },
  { key: "replaced", label: "selbst gewählt" },
  { key: "skipped", label: "ausgefallen" },
  { key: "other", label: "anderes gegessen" },
] as const;

function Tile({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly hint?: string | undefined;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        {value === undefined ? (
          <Skeleton width="60%" height={40} />
        ) : (
          <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
        )}
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function FoodAnalytics() {
  const [period, setPeriod] = useState<FoodPeriod>("4w");
  const query = useFoodAnalytics(period);
  const palette = useChartPalette();
  const data = query.data;
  const adherenceTotal = data ? ADHERENCE.reduce((sum, entry) => sum + data.adherence[entry.key], 0) : 0;

  return (
    <Box component="section" aria-label="Essen">
      <ToggleButtonGroup
        exclusive
        size="small"
        value={period}
        onChange={(_event, value: FoodPeriod | null) => value && setPeriod(value)}
        aria-label="Zeitraum Essen"
        sx={{ mb: 2 }}
      >
        {FOOD_PERIODS.map((value) => (
          <ToggleButton key={value} value={value}>
            {PERIOD_LABELS[value]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {query.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Die Essens-Auswertung konnte nicht geladen werden. {errorMessage(query.error)}
        </Alert>
      )}
      {data && data.meals === 0 ? (
        <Alert severity="info">
          Für diesen Zeitraum gibt es noch keine gegessenen Mahlzeiten. Sobald der Essensplan ein paar Tage läuft, steht
          hier, was ihr gegessen habt.
        </Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }} component="section" aria-label="Kennzahlen Essen">
            <Grid size={{ xs: 6, md: 3 }}>
              <Tile
                label="Mahlzeiten"
                value={data?.meals.toLocaleString("de-DE")}
                hint={data ? `${formatShortDate(data.from)} – ${formatShortDate(data.to)}` : undefined}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Tile
                label="Vegetarisch"
                value={data ? formatPercent(data.vegetarianShare) : undefined}
                hint="ohne vegetarische Varianten"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Tile
                label="Abwechslung"
                value={data ? `${data.variety.distinctDishes} Gerichte` : undefined}
                hint={data ? `bei ${data.variety.meals} Mahlzeiten` : undefined}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Tile
                label="Kosten (Schätzung)"
                value={data ? formatEuro(data.cost.total) : undefined}
                hint={data?.cost.perMeal != null ? `Ø ${formatEuro(data.cost.perMeal)} pro Mahlzeit` : undefined}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartSection<FoodAnalyticsData>
                title="Proteinquellen"
                description="Mahlzeiten je Fleisch- oder Fischart"
                query={query}
                table={(value) => (
                  <DataTable
                    caption="Proteinquellen"
                    head={["Quelle", "Mahlzeiten"]}
                    rows={value.protein.map((entry) => [proteinLabel(entry.tag), entry.count])}
                  />
                )}
              >
                {(value) => (
                  <BarList
                    color={palette.series(0)}
                    rows={value.protein.map((entry) => ({
                      key: entry.tag,
                      label: proteinLabel(entry.tag),
                      value: entry.count,
                      valueLabel: String(entry.count),
                      description: `${proteinLabel(entry.tag)}: ${entry.count} Mahlzeiten`,
                    }))}
                  />
                )}
              </ChartSection>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartSection<FoodAnalyticsData>
                title="Lieblingsgerichte"
                description="Am häufigsten gegessen, 👍 zuerst"
                query={query}
                table={(value) => (
                  <DataTable
                    caption="Lieblingsgerichte"
                    head={["Gericht", "Mal", "Bewertung"]}
                    rows={value.favorites.map((entry) => [
                      entry.name,
                      entry.count,
                      entry.feedback === "UP" ? "👍" : entry.feedback === "DOWN" ? "👎" : "–",
                    ])}
                  />
                )}
              >
                {(value) => (
                  <BarList
                    color={palette.series(0)}
                    rows={value.favorites.map((entry) => ({
                      key: entry.dishId,
                      label: entry.name,
                      value: entry.count,
                      valueLabel: `${entry.count}×${entry.feedback === "UP" ? " 👍" : entry.feedback === "DOWN" ? " 👎" : ""}`,
                      description: `${entry.name}: ${entry.count}× gegessen`,
                    }))}
                  />
                )}
              </ChartSection>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartSection<FoodAnalyticsData>
                title="Kosten pro Woche"
                description="Geschätzt für die, die mitgegessen haben"
                query={query}
                table={(value) => (
                  <DataTable
                    caption="Kosten pro Woche"
                    head={["Woche ab", "Kosten"]}
                    rows={value.cost.weeks.map((week) => [formatShortDate(week.weekStart), formatEuro(week.total)])}
                  />
                )}
              >
                {(value) => (
                  <ColumnChart
                    color={palette.series(0)}
                    ariaLabel="Kosten pro Woche"
                    columns={value.cost.weeks.map((week) => ({
                      key: week.weekStart,
                      label: formatShortDate(week.weekStart),
                      value: Math.round(week.total),
                      description: `Woche ab ${formatShortDate(week.weekStart)}: ${formatEuro(week.total)}`,
                    }))}
                  />
                )}
              </ChartSection>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartSection<FoodAnalyticsData>
                title="Plan eingehalten"
                description="Vergangene Mahlzeiten"
                query={query}
                table={(value) => (
                  <DataTable
                    caption="Plan eingehalten"
                    head={["Ergebnis", "Mahlzeiten"]}
                    rows={ADHERENCE.map((entry) => [entry.label, value.adherence[entry.key]])}
                  />
                )}
              >
                {(value) => (
                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <StackedBar
                      ariaLabel="Plan eingehalten"
                      segments={ADHERENCE.map((entry, index) => ({
                        key: entry.key,
                        label: entry.label,
                        share: adherenceTotal === 0 ? 0 : value.adherence[entry.key] / adherenceTotal,
                        color: palette.series(index),
                      }))}
                    />
                    <Legend
                      items={ADHERENCE.map((entry, index) => ({
                        key: entry.key,
                        label: `${entry.label}: ${value.adherence[entry.key]}`,
                        color: palette.series(index),
                      }))}
                    />
                  </Box>
                )}
              </ChartSection>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ChartSection<FoodAnalyticsData>
                title="Lange nicht gegessen"
                description="Aktive Gerichte, die im Zeitraum nicht auf dem Tisch waren"
                query={query}
              >
                {(value) =>
                  value.rarelyEaten.length === 0 ? (
                    <Typography color="text.secondary">Alle Gerichte kamen vor.</Typography>
                  ) : (
                    <Typography>{value.rarelyEaten.map((entry) => entry.name).join(", ")}</Typography>
                  )
                }
              </ChartSection>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
