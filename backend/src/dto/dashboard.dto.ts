/** GET /dashboard contracts (TICKET-016). */

import type { Category, UserId } from "../models/index.js";

export interface DashboardRequest {
  readonly assignedTo?: UserId | undefined;
  readonly category?: Category | undefined;
  /** Reference date YYYY-MM-DD. Default: today in the application timezone. */
  readonly date?: string | undefined;
}

export interface DashboardTennerResponse {
  readonly tennerId: string;
  readonly title: string;
  readonly category: Category;
  readonly assignedTo: UserId;
  readonly estimatedMinutes: number;
  readonly nextDue: string;
  /** Postponed-to date (SCHEDULING-003), or null. */
  readonly snoozedUntil: string | null;
  /** Overdue section only: days since nextDue. */
  readonly overdueDays?: number;
  /** Upcoming section only: days until nextDue (1 - 7). */
  readonly daysUntilDue?: number;
}

export interface DashboardSummaryResponse {
  readonly dueTodayCount: number;
  readonly overdueCount: number;
  readonly upcomingCount: number;
  readonly dueTodayMinutes: number;
  readonly overdueMinutes: number;
  readonly upcomingMinutes: number;
  /** Due today + overdue (upcoming is informational). */
  readonly totalActionableCount: number;
  readonly totalActionableMinutes: number;
}

export interface DashboardGroupSummary {
  readonly count: number;
  readonly estimatedMinutes: number;
}

export interface DashboardResponse {
  readonly referenceDate: string;
  readonly timezone: string;
  readonly summary: DashboardSummaryResponse;
  readonly dueToday: DashboardTennerResponse[];
  readonly overdue: DashboardTennerResponse[];
  readonly upcoming: DashboardTennerResponse[];
  /** Actionable workload per assigned user (users without actionable Tenners omitted). */
  readonly byUser: Partial<Record<UserId, DashboardGroupSummary>>;
  /** Actionable workload per category (categories without actionable Tenners omitted). */
  readonly byCategory: Partial<Record<Category, DashboardGroupSummary>>;
}
