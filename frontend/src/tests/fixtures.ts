/** Test data builders matching the backend contracts. */

import type { Dashboard, DashboardTenner } from "../features/dashboard/api";
import type { Tenner } from "../features/tenners/schemas";

export function dashboardTenner(overrides: Partial<DashboardTenner> = {}): DashboardTenner {
  return {
    tennerId: "t-1",
    title: "Büro saugen",
    category: "HOUSEHOLD",
    assignedTo: "STEFAN",
    estimatedMinutes: 10,
    nextDue: "2026-10-02",
    snoozedUntil: null,
    ...overrides,
  };
}

export function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  const dueToday = overrides.dueToday ?? [dashboardTenner()];
  const overdue = overrides.overdue ?? [
    dashboardTenner({
      tennerId: "t-2",
      title: "Haustür putzen",
      category: "HOME",
      assignedTo: "JULIA",
      estimatedMinutes: 15,
      nextDue: "2026-09-20",
      overdueDays: 12,
    }),
  ];
  const upcoming = overrides.upcoming ?? [
    dashboardTenner({
      tennerId: "t-3",
      title: "Auto waschen",
      category: "PERSONAL",
      estimatedMinutes: 30,
      nextDue: "2026-10-05",
      daysUntilDue: 3,
    }),
  ];
  const minutes = (list: readonly DashboardTenner[]) => list.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  return {
    referenceDate: "2026-10-02",
    timezone: "Europe/Berlin",
    summary: {
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      dueTodayMinutes: minutes(dueToday),
      overdueMinutes: minutes(overdue),
      upcomingMinutes: minutes(upcoming),
      totalActionableCount: dueToday.length + overdue.length,
      totalActionableMinutes: minutes(dueToday) + minutes(overdue),
    },
    byUser: { STEFAN: { count: 1, estimatedMinutes: 10 }, JULIA: { count: 1, estimatedMinutes: 15 } },
    byCategory: { HOUSEHOLD: { count: 1, estimatedMinutes: 10 }, HOME: { count: 1, estimatedMinutes: 15 } },
    ...overrides,
    dueToday,
    overdue,
    upcoming,
  };
}

export function tenner(overrides: Partial<Tenner> = {}): Tenner {
  return {
    tennerId: "t-1",
    title: "Büro saugen",
    category: "HOUSEHOLD",
    estimatedMinutes: 10,
    frequencyDays: 14,
    frequencyUnit: "DAY",
    frequencyInterval: 14,
    assignedTo: "STEFAN",
    lastCompleted: null,
    nextDue: "2026-10-02",
    snoozedUntil: null,
    active: true,
    deletedAt: null,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-09-01T08:00:00Z",
    ...overrides,
  };
}

export function completeResponse(tennerId = "t-1") {
  return {
    tenner: tenner({ tennerId, lastCompleted: "2026-10-02T08:00:00Z", nextDue: "2026-10-16" }),
    completion: {
      completionId: "c-1",
      tennerId,
      completedBy: "STEFAN",
      completedAt: "2026-10-02T08:00:00Z",
      actualMinutes: 10,
    },
  };
}
