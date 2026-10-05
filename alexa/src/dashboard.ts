/** GET /dashboard as the skill reads it (TICKET-016; ALEXA-003). All classification comes from the API. */

import type { TennerApi } from "./tennerApi.js";

/** Assignee of shared Tenners (HOUSEHOLD-002), mirrors SHARED_ASSIGNEE in the backend. */
export const SHARED_ASSIGNEE = "HOUSEHOLD";

export interface DashboardTenner {
  readonly tennerId: string;
  readonly title: string;
  readonly category: string;
  readonly assignedTo: string;
  readonly estimatedMinutes: number;
  readonly nextDue: string;
  readonly overdueDays?: number;
  readonly daysUntilDue?: number;
}

export interface DashboardSummary {
  readonly dueTodayCount: number;
  readonly overdueCount: number;
  readonly upcomingCount: number;
  readonly dueTodayMinutes: number;
  readonly overdueMinutes: number;
  readonly totalActionableCount: number;
  readonly totalActionableMinutes: number;
}

export interface Dashboard {
  readonly referenceDate: string;
  readonly timezone: string;
  readonly summary: DashboardSummary;
  readonly dueToday: readonly DashboardTenner[];
  readonly overdue: readonly DashboardTenner[];
  readonly upcoming: readonly DashboardTenner[];
  /** Paused Tenners are excluded from every other section; the skill never reads them. */
  readonly paused: readonly DashboardTenner[];
  readonly byUser: Readonly<Record<string, { readonly count: number; readonly estimatedMinutes: number } | undefined>>;
}

/** The dashboard for one member (own + shared Tenners) or the whole household (assignedTo undefined). */
export function fetchDashboard(api: TennerApi, assignedTo: string | undefined): Promise<Dashboard> {
  const query = assignedTo === undefined ? "" : `?assignedTo=${encodeURIComponent(assignedTo)}`;
  return api.request<Dashboard>("GET", `/dashboard${query}`);
}
