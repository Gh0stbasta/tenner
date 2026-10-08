/**
 * Analytics sections (ANALYTICS-009). Each loads its own endpoint and fails or hides independently (ChartSection);
 * every chart has a table view.
 */

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { Box, Stack, Typography } from "@mui/material";
import { TennerLink } from "../../components/TennerLink";
import { formatMinutes } from "../../utils/format";
import { useMemberName } from "../members/api";
import {
  useAnalyticsBalance,
  useAnalyticsCategories,
  useAnalyticsHabits,
  useAnalyticsNeglected,
  useAnalyticsTime,
  useAnalyticsTrends,
  type HabitTrend,
  type PeriodSelection,
} from "./api";
import { BarList, ColumnChart, DataTable, Legend, StackedBar } from "./charts";
import { bucketLabel, formatPercent } from "./format";
import { ChartSection } from "./ChartSection";
import { MAX_SERIES, STATUS_COLORS, useChartPalette } from "./chartColors";
import { granularityFor } from "./period";

const completionsText = (count: number) =>
  `${count.toLocaleString("de-DE")} ${count === 1 ? "Erledigung" : "Erledigungen"}`;

export function TrendChart({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsTrends(selection, granularityFor(selection));
  const palette = useChartPalette();
  return (
    <ChartSection
      title="Verlauf"
      description="Erledigungen im gewählten Zeitraum"
      query={query}
      table={(data) => (
        <DataTable
          caption="Verlauf als Tabelle"
          head={["Zeitraum", "Erledigungen", "Minuten"]}
          rows={data.buckets.map((bucket) => [
            bucketLabel(bucket.start, data.granularity).long,
            bucket.completions,
            bucket.actualMinutes,
          ])}
        />
      )}
    >
      {(data) => {
        const change = data.comparison.changePercent;
        return (
          <>
            <ColumnChart
              color={palette.series(0)}
              ariaLabel={`Erledigungen pro ${data.granularity === "day" ? "Tag" : data.granularity === "week" ? "Woche" : "Monat"}, ${completionsText(data.buckets.reduce((sum, bucket) => sum + bucket.completions, 0))} insgesamt`}
              columns={data.buckets.map((bucket) => {
                const label = bucketLabel(bucket.start, data.granularity);
                return {
                  key: bucket.start,
                  label: label.short,
                  value: bucket.completions,
                  description: `${label.long}: ${completionsText(bucket.completions)}, ${formatMinutes(bucket.actualMinutes)}`,
                };
              })}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {change === null
                ? "Kein Vergleich: Im Zeitraum davor gab es keine Erledigungen."
                : `${change > 0 ? "+" : ""}${change.toLocaleString("de-DE")} % gegenüber dem Zeitraum davor (${completionsText(data.comparison.previousPeriodCompletions)}).`}
            </Typography>
          </>
        );
      }}
    </ChartSection>
  );
}

/** Health with icon + label; color never carries the meaning alone. */
function Health({ score }: { readonly score: number | null }) {
  if (score === null) return null;
  const [Icon, color, label] =
    score >= 0.8
      ? [CheckCircleOutlineIcon, STATUS_COLORS.good, "Gut"]
      : score >= 0.5
        ? [ReportProblemOutlinedIcon, STATUS_COLORS.warning, "Achtung"]
        : [ErrorOutlineIcon, STATUS_COLORS.critical, "Kritisch"];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Icon fontSize="small" sx={{ color }} aria-hidden />
      <Typography variant="body2" component="span">
        {label}
      </Typography>
    </Box>
  );
}

const healthText = (score: number | null) =>
  score === null ? "keine aktiven Aufgaben" : score >= 0.8 ? "Gut" : score >= 0.5 ? "Achtung" : "Kritisch";

export function CategoryChart({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsCategories(selection);
  const palette = useChartPalette();
  return (
    <ChartSection
      title="Lebensbereiche"
      description="Investierte Minuten je Kategorie und wie viel dort gerade überfällig ist"
      query={query}
      table={(data) => (
        <DataTable
          caption="Lebensbereiche als Tabelle"
          head={["Kategorie", "Minuten", "Anteil", "Erledigungen", "Aktive Aufgaben", "Überfällig", "Zustand"]}
          rows={data.categories.map((c) => [
            c.name,
            c.actualMinutes,
            formatPercent(c.shareOfMinutes),
            c.completions,
            c.activeTenners,
            c.overdueNow,
            healthText(c.healthScore),
          ])}
        />
      )}
    >
      {(data) => (
        <BarList
          color={palette.series(0)}
          rows={data.categories
            .filter((c) => !c.archived || c.actualMinutes > 0 || c.activeTenners > 0)
            .map((c) => ({
              key: c.category,
              label: c.name,
              value: c.actualMinutes,
              valueLabel: formatMinutes(c.actualMinutes),
              description: `${c.name}: ${formatMinutes(c.actualMinutes)} (${formatPercent(c.shareOfMinutes)}), ${c.overdueNow} von ${c.activeTenners} überfällig`,
              extra: <Health score={c.healthScore} />,
            }))}
        />
      )}
    </ChartSection>
  );
}

export function BalanceChart({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsBalance(selection);
  const palette = useChartPalette();
  return (
    <ChartSection
      title="Verteilung im Haushalt"
      description="Wer hat wie viel erledigt, und wie ist die geplante Arbeit verteilt?"
      query={query}
      table={(data) => (
        <DataTable
          caption="Verteilung als Tabelle"
          head={["Person", "Anteil erledigte Minuten", "Anteil geplante Arbeit"]}
          rows={data.byUser.map((user) => [
            user.displayName,
            formatPercent(user.shareOfMinutes),
            formatPercent(user.shareOfAssignedLoad),
          ])}
        />
      )}
    >
      {(data) => {
        // Color follows the member's position in the member list (never the ranking); beyond the palette: "Weitere".
        const colorOf = (index: number) => palette.series(Math.min(index, MAX_SERIES));
        const segments = (pick: "shareOfMinutes" | "shareOfAssignedLoad") =>
          data.byUser.map((user, index) => ({
            key: user.userId,
            label: user.displayName,
            share: user[pick] ?? 0,
            color: colorOf(index),
          }));
        const describe = (pick: "shareOfMinutes" | "shareOfAssignedLoad") =>
          data.byUser.map((user) => `${user.displayName} ${formatPercent(user[pick])}`).join(", ");
        const rows = [
          { key: "done", title: "Erledigte Minuten", pick: "shareOfMinutes" as const },
          { key: "load", title: "Geplante Arbeit pro Woche", pick: "shareOfAssignedLoad" as const },
        ];
        return (
          <Stack spacing={2}>
            {rows.map((row) => (
              <Box key={row.key}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {row.title}
                </Typography>
                {data.byUser.every((user) => user[row.pick] === null) ? (
                  <Typography variant="body2" color="text.secondary">
                    Noch keine Daten.
                  </Typography>
                ) : (
                  <>
                    <StackedBar ariaLabel={`${row.title}: ${describe(row.pick)}`} segments={segments(row.pick)} />
                    <Typography variant="caption" color="text.secondary">
                      {describe(row.pick)}
                    </Typography>
                  </>
                )}
              </Box>
            ))}
            <Legend
              items={data.byUser.map((user, index) => ({
                key: user.userId,
                label: user.displayName,
                color: colorOf(index),
              }))}
            />
            {data.balanceIndex !== null && (
              <Typography variant="body2" color="text.secondary">
                Ausgewogenheit: {formatPercent(data.balanceIndex)} (100 % = alle gleich viel)
              </Typography>
            )}
          </Stack>
        );
      }}
    </ChartSection>
  );
}

export function NeglectedTable({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsNeglected(selection);
  const memberName = useMemberName();
  return (
    <ChartSection
      title="Vernachlässigte Aufgaben"
      description="Was bleibt hinter seinem Rhythmus zurück? (Top 10)"
      query={query}
    >
      {(data) =>
        data.items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nichts vernachlässigt. 🎉
          </Typography>
        ) : (
          <DataTable
            caption="Vernachlässigte Aufgaben"
            head={["Aufgaben", "Zuständig", "Überfällig", "Erledigt / erwartet", "Vernachlässigung"]}
            rows={data.items.map((item) => [
              <TennerLink key="link" tennerId={item.tennerId}>
                {item.title}
              </TennerLink>,
              memberName(item.assignedTo),
              item.daysOverdue === 0 ? "–" : `${item.daysOverdue} T.`,
              `${item.actualCompletions} / ${item.expectedCompletions}`,
              formatPercent(item.neglectScore),
            ])}
          />
        )
      }
    </ChartSection>
  );
}

const TREND: Readonly<Record<NonNullable<HabitTrend>, { icon: typeof TrendingUpIcon; label: string }>> = {
  IMPROVING: { icon: TrendingUpIcon, label: "Besser" },
  STABLE: { icon: TrendingFlatIcon, label: "Stabil" },
  DECLINING: { icon: TrendingDownIcon, label: "Schlechter" },
};

function Trend({ trend }: { readonly trend: HabitTrend }) {
  if (trend === null) return <>–</>;
  const { icon: Icon, label } = TREND[trend];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Icon fontSize="small" aria-hidden />
      {label}
    </Box>
  );
}

export function HabitsTable({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsHabits(selection);
  return (
    <ChartSection title="Gewohnheiten" description="Beständigkeit im eigenen Rhythmus jeder Aufgabe" query={query}>
      {(data) => (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Beständigkeit im Haushalt: <strong>{formatPercent(data.householdConsistency)}</strong>
          </Typography>
          {data.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Noch keine aktiven Aufgaben.
            </Typography>
          ) : (
            <DataTable
              caption="Gewohnheiten"
              head={["Aufgaben", "Serie", "Längste Serie", "Beständigkeit", "Trend"]}
              rows={data.items.map((item) => [
                <TennerLink key="link" tennerId={item.tennerId}>
                  {item.title}
                </TennerLink>,
                item.currentStreak,
                item.longestStreak,
                item.consistencyScore === null ? "zu wenig Daten" : formatPercent(item.consistencyScore),
                <Trend key="trend" trend={item.trend} />,
              ])}
            />
          )}
        </>
      )}
    </ChartSection>
  );
}

export function TimeInvestmentCard({ selection }: { readonly selection: PeriodSelection }) {
  const query = useAnalyticsTime(selection);
  return (
    <ChartSection title="Zeitaufwand" description="Wie viel Zeit brauchen die Aufgaben wirklich?" query={query}>
      {(data) => (
        <Stack spacing={1}>
          <Typography variant="body2">
            Geplant pro Woche: <strong>{formatMinutes(data.projectedMinutesPerWeek)}</strong>
          </Typography>
          <Typography variant="body2">
            Tatsächlich im Schnitt pro Woche: <strong>{formatMinutes(data.averageMinutesPerWeek)}</strong>
          </Typography>
          <Typography variant="body2">
            Aufgaben über 10 Minuten: <strong>{data.tennersExceedingTenMinutes}</strong>
          </Typography>
          {data.tennersExceedingEstimate.length > 0 && (
            <DataTable
              caption="Aufgaben, die länger dauern als geschätzt"
              head={["Länger als geschätzt", "Geschätzt", "Tatsächlich (Median)"]}
              rows={data.tennersExceedingEstimate.map((item) => [
                <TennerLink key="link" tennerId={item.tennerId}>
                  {item.title}
                </TennerLink>,
                formatMinutes(item.estimatedMinutes),
                formatMinutes(item.medianActualMinutes),
              ])}
            />
          )}
        </Stack>
      )}
    </ChartSection>
  );
}
