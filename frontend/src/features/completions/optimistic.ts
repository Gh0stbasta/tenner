/** Optimistic dashboard update after a completion (FRONTEND-007). */

import type { Dashboard, DashboardTenner, GroupSummary } from "../dashboard/api";

function decrement<K extends string>(
  groups: Partial<Record<K, GroupSummary>>,
  key: K,
  minutes: number,
): Partial<Record<K, GroupSummary>> {
  const group = groups[key];
  if (!group) return groups;
  if (group.count <= 1) {
    return Object.fromEntries(Object.entries(groups).filter(([name]) => name !== key)) as Partial<
      Record<K, GroupSummary>
    >;
  }
  return {
    ...groups,
    [key]: { count: group.count - 1, estimatedMinutes: Math.max(0, group.estimatedMinutes - minutes) },
  };
}

/** The dashboard without the completed Tenner in "due today" or "overdue"; summary and groups adjusted. */
export function removeFromDashboard(dashboard: Dashboard, tennerId: string): Dashboard {
  const find = (list: readonly DashboardTenner[]) => list.find((t) => t.tennerId === tennerId);
  const dueTodayItem = find(dashboard.dueToday);
  const overdueItem = find(dashboard.overdue);
  const removed = dueTodayItem ?? overdueItem;
  if (!removed) return dashboard;

  const minutes = removed.estimatedMinutes;
  const { summary } = dashboard;
  return {
    ...dashboard,
    dueToday: dashboard.dueToday.filter((t) => t.tennerId !== tennerId),
    overdue: dashboard.overdue.filter((t) => t.tennerId !== tennerId),
    summary: {
      ...summary,
      dueTodayCount: summary.dueTodayCount - (dueTodayItem ? 1 : 0),
      dueTodayMinutes: summary.dueTodayMinutes - (dueTodayItem ? minutes : 0),
      overdueCount: summary.overdueCount - (overdueItem ? 1 : 0),
      overdueMinutes: summary.overdueMinutes - (overdueItem ? minutes : 0),
      totalActionableCount: summary.totalActionableCount - 1,
      totalActionableMinutes: summary.totalActionableMinutes - minutes,
    },
    byUser: decrement(dashboard.byUser, removed.assignedTo, minutes),
    byCategory: decrement(dashboard.byCategory, removed.category, minutes),
  };
}
