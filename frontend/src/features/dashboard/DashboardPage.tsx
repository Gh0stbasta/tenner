/**
 * Dashboard (FRONTEND-002, redesigned by UI-001): the family's day — what we eat today, what we do today and what
 * to buy for tomorrow. Reporting (counts, workload, upcoming) lives in „Aufgaben“ and „Auswertung“; Aufgaben are
 * created in „Aufgaben“.
 */

import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../api/errorMessages";
import { queryKeys } from "../../api/queryKeys";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PageLoading } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { formatLongDate } from "../../utils/format";
import { TodayMealsCard } from "../meals/TodayMealsCard";
import { PullToRefresh } from "../mobile/PullToRefresh";
import { useDashboard } from "./api";
import { ShoppingTomorrowCard } from "./ShoppingTomorrowCard";
import { TodayTasksCard } from "./TodayTasksCard";

export function DashboardPage() {
  const dashboard = useDashboard();
  const queryClient = useQueryClient();
  // Pull-to-refresh (MOBILE-005) reloads everything the dashboard shows.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity }),
      queryClient.invalidateQueries({ queryKey: ["mealPlans"] }),
      queryClient.invalidateQueries({ queryKey: ["shoppingLists"] }),
    ]);

  if (dashboard.isPending) return <PageLoading label="Dashboard wird geladen" />;
  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Heute" />
        <ErrorAlert
          title="Dashboard konnte nicht geladen werden"
          message={errorMessage(dashboard.error)}
          onRetry={() => void dashboard.refetch()}
        />
      </>
    );
  }

  const data = dashboard.data;
  return (
    <PullToRefresh onRefresh={refresh}>
      <PageHeader title="Heute" subtitle={formatLongDate(data.referenceDate)} />
      <TodayMealsCard />
      <TodayTasksCard open={[...data.overdue, ...data.dueToday]} />
      <ShoppingTomorrowCard />
    </PullToRefresh>
  );
}
