/** Dashboard (FRONTEND-002): what should I do today? */

import Grid from "@mui/material/Grid";
import { ErrorAlert } from "../../components/ErrorAlert";
import { NoDashboardData } from "../../components/EmptyState";
import { PageLoading } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { formatLongDate, formatMinutes, formatTennerCount } from "../../utils/format";
import { RecentActivityWidget } from "../completions/RecentActivityWidget";
import { QuickAddTenner } from "../tenners/QuickAddTenner";
import { useDashboard, type Dashboard } from "./api";
import { DueTodayList } from "./DueTodayList";
import { OverdueList } from "./OverdueList";
import { SummaryCards } from "./SummaryCards";
import { UpcomingList } from "./UpcomingList";
import { CategorySummaryCard, UserSummaryCard } from "./WorkloadCards";

function headerSubtitle(dashboard: Dashboard): string {
  const { summary } = dashboard;
  const parts = [
    formatLongDate(dashboard.referenceDate),
    formatTennerCount(summary.totalActionableCount),
    formatMinutes(summary.totalActionableMinutes),
  ];
  if (summary.overdueCount > 0) parts.push(`${summary.overdueCount} überfällig`);
  return parts.join(" · ");
}

export function DashboardPage() {
  const dashboard = useDashboard();

  if (dashboard.isPending) return <PageLoading label="Dashboard wird geladen" />;
  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Heute" />
        <ErrorAlert
          title="Dashboard konnte nicht geladen werden"
          message="Bitte versuche es erneut."
          onRetry={() => void dashboard.refetch()}
        />
      </>
    );
  }

  const data = dashboard.data;
  return (
    <>
      <PageHeader title="Heute" subtitle={headerSubtitle(data)} />
      <QuickAddTenner />
      <SummaryCards summary={data.summary} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          {data.summary.totalActionableCount === 0 && <NoDashboardData />}
          <DueTodayList tenners={data.dueToday} />
          <OverdueList tenners={data.overdue} />
          <UpcomingList tenners={data.upcoming} />
          <RecentActivityWidget />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <UserSummaryCard byUser={data.byUser} />
          <CategorySummaryCard byCategory={data.byCategory} />
        </Grid>
      </Grid>
    </>
  );
}
