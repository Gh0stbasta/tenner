/** /analytics (ANALYTICS-009): replaces the FRONTEND-001 placeholder. Sections load and fail independently. */

import { Tab, Tabs } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useState } from "react";
import { FoodAnalytics } from "./FoodAnalytics";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSelector } from "./PeriodSelector";
import { usePeriodSelection } from "./period";
import { BalanceChart, CategoryChart, HabitsTable, NeglectedTable, TimeInvestmentCard, TrendChart } from "./sections";
import { SummaryCards } from "./SummaryCards";

export function AnalyticsPage() {
  const [selection, setSelection] = usePeriodSelection();
  // FOOD-019: „Essen“ next to the Aufgaben analytics.
  const [tab, setTab] = useState<"tasks" | "food">("tasks");
  return (
    <>
      <PageHeader title="Auswertung" />
      <Tabs
        value={tab}
        onChange={(_event, value: "tasks" | "food") => setTab(value)}
        aria-label="Bereich"
        sx={{ mb: 2 }}
      >
        <Tab value="tasks" label="Aufgaben" />
        <Tab value="food" label="Essen" />
      </Tabs>
      {tab === "food" ? (
        <FoodAnalytics />
      ) : (
        <>
          <PeriodSelector
            key={"period" in selection ? selection.period : `${selection.from}:${selection.to}`}
            value={selection}
            onChange={setSelection}
          />
          <SummaryCards selection={selection} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendChart selection={selection} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <CategoryChart selection={selection} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <BalanceChart selection={selection} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TimeInvestmentCard selection={selection} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <NeglectedTable selection={selection} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <HabitsTable selection={selection} />
            </Grid>
          </Grid>
        </>
      )}
    </>
  );
}
