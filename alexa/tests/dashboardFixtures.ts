/** Dashboard fixtures in the shape of GET /dashboard (same titles as the frontend fixtures). */
import type { Dashboard, DashboardTenner } from "../src/dashboard.js";

export function dashboardTenner(overrides: Partial<DashboardTenner> = {}): DashboardTenner {
  return { tennerId: "t-1", title: "Büro saugen", category: "HOUSEHOLD", assignedTo: "STEFAN", estimatedMinutes: 10, nextDue: "2026-10-05", ...overrides };
}

export function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  const dueToday = overrides.dueToday ?? [dashboardTenner()];
  const overdue = overrides.overdue ?? [];
  const upcoming = overrides.upcoming ?? [];
  const sum = (list: readonly DashboardTenner[]) => list.reduce((total, tenner) => total + tenner.estimatedMinutes, 0);
  return {
    referenceDate: "2026-10-05",
    timezone: "Europe/Berlin",
    summary: {
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      dueTodayMinutes: sum(dueToday),
      overdueMinutes: sum(overdue),
      totalActionableCount: dueToday.length + overdue.length,
      totalActionableMinutes: sum(dueToday) + sum(overdue),
    },
    dueToday,
    overdue,
    upcoming,
    paused: [],
    byUser: {},
    ...overrides,
  };
}

export const KITCHEN_DAY = dashboard({
  dueToday: [
    dashboardTenner({ tennerId: "a", title: "Auto waschen", estimatedMinutes: 30 }),
    dashboardTenner({ tennerId: "b", title: "Altglas", estimatedMinutes: 5 }),
    dashboardTenner({ tennerId: "c", title: "Pflanzen gießen", assignedTo: "JULIA", estimatedMinutes: 10 }),
    dashboardTenner({ tennerId: "d", title: "Spülmaschine ausräumen", assignedTo: "HOUSEHOLD", estimatedMinutes: 10 }),
  ],
  overdue: [
    dashboardTenner({ tennerId: "e", title: "Fenster putzen", assignedTo: "JULIA", estimatedMinutes: 20, overdueDays: 1 }),
    dashboardTenner({ tennerId: "f", title: "Haustür putzen", assignedTo: "JULIA", estimatedMinutes: 10, overdueDays: 4 }),
  ],
  paused: [dashboardTenner({ tennerId: "p", title: "Pool reinigen", estimatedMinutes: 5 })],
  byUser: { STEFAN: { count: 3, estimatedMinutes: 40 }, JULIA: { count: 4, estimatedMinutes: 45 } },
});
