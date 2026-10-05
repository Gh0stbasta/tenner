/** /analytics (ANALYTICS-009): replaces the FRONTEND-001 placeholder. Sections load and fail independently. */

import Grid from "@mui/material/Grid";
import { PageHeader } from "../../components/PageHeader";
import { PeriodSelector } from "./PeriodSelector";
import { usePeriodSelection } from "./period";
import { BalanceChart, CategoryChart, HabitsTable, NeglectedTable, TimeInvestmentCard, TrendChart } from "./sections";
import { SummaryCards } from "./SummaryCards";

export function AnalyticsPage() {
  const [selection, setSelection] = usePeriodSelection();
  return (
    <>
      <PageHeader title="Auswertung" />
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
  );
}
