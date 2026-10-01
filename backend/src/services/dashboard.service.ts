/** Dashboard read model (TICKET-016): due today, overdue, upcoming and workload summaries in one response. */

import type {
  DashboardGroupSummary,
  DashboardRequest,
  DashboardResponse,
  DashboardSummaryResponse,
  DashboardTennerResponse,
} from "../dto/index.js";
import type { Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { addDays, type Clock } from "../utils/clock.js";
import { dateInTimeZone, daysBetween } from "../utils/timezone.js";

/** Upcoming window: referenceDate < nextDue <= referenceDate + UPCOMING_DAYS. */
export const UPCOMING_DAYS = 7;

type Comparator = (a: Tenner, b: Tenner) => number;
const byString = (key: "title" | "nextDue"): Comparator => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);
const byMinutes: Comparator = (a, b) => a.estimatedMinutes - b.estimatedMinutes;
const chain =
  (...comparators: Comparator[]): Comparator =>
  (a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };

/** Section sort orders as specified. */
export const SORT_DUE_TODAY = chain(byMinutes, byString("title"));
export const SORT_OVERDUE = chain(byString("nextDue"), byString("title"));
export const SORT_UPCOMING = chain(byString("nextDue"), byMinutes, byString("title"));

export class DashboardService {
  constructor(
    private readonly repository: Pick<TennerRepository, "getDashboardCandidates">,
    private readonly clock: Clock,
    private readonly timezone: string,
  ) {}

  async getDashboard(tenantId: string, request: DashboardRequest = {}): Promise<DashboardResponse> {
    const referenceDate = request.date ?? dateInTimeZone(this.clock(), this.timezone);
    const endDate = addDays(referenceDate, UPCOMING_DAYS);
    const candidates = (await this.repository.getDashboardCandidates(tenantId, endDate)).filter(
      (t) =>
        t.active &&
        t.deletedAt === null &&
        (request.assignedTo === undefined || t.assignedTo === request.assignedTo) &&
        (request.category === undefined || t.category === request.category),
    );

    const dueToday = candidates.filter((t) => t.nextDue === referenceDate).sort(SORT_DUE_TODAY);
    const overdue = candidates.filter((t) => t.nextDue < referenceDate).sort(SORT_OVERDUE);
    const upcoming = candidates.filter((t) => t.nextDue > referenceDate && t.nextDue <= endDate).sort(SORT_UPCOMING);
    const actionable = [...dueToday, ...overdue];

    return {
      referenceDate,
      timezone: this.timezone,
      summary: summarize(dueToday, overdue, upcoming),
      dueToday: dueToday.map((t) => toItem(t)),
      overdue: overdue.map((t) => toItem(t, { overdueDays: daysBetween(t.nextDue, referenceDate) })),
      upcoming: upcoming.map((t) => toItem(t, { daysUntilDue: daysBetween(referenceDate, t.nextDue) })),
      byUser: groupBy(actionable, (t) => t.assignedTo),
      byCategory: groupBy(actionable, (t) => t.category),
    };
  }
}

const minutes = (tenners: readonly Tenner[]): number => tenners.reduce((sum, t) => sum + t.estimatedMinutes, 0);

function summarize(dueToday: Tenner[], overdue: Tenner[], upcoming: Tenner[]): DashboardSummaryResponse {
  return {
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    upcomingCount: upcoming.length,
    dueTodayMinutes: minutes(dueToday),
    overdueMinutes: minutes(overdue),
    upcomingMinutes: minutes(upcoming),
    totalActionableCount: dueToday.length + overdue.length,
    totalActionableMinutes: minutes(dueToday) + minutes(overdue),
  };
}

function groupBy<K extends string>(tenners: readonly Tenner[], key: (t: Tenner) => K): Partial<Record<K, DashboardGroupSummary>> {
  const groups: Partial<Record<K, DashboardGroupSummary>> = {};
  for (const tenner of tenners) {
    const current = groups[key(tenner)] ?? { count: 0, estimatedMinutes: 0 };
    groups[key(tenner)] = { count: current.count + 1, estimatedMinutes: current.estimatedMinutes + tenner.estimatedMinutes };
  }
  return groups;
}

function toItem(tenner: Tenner, extra: { overdueDays?: number; daysUntilDue?: number } = {}): DashboardTennerResponse {
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    category: tenner.category,
    assignedTo: tenner.assignedTo,
    estimatedMinutes: tenner.estimatedMinutes,
    nextDue: tenner.nextDue,
    ...extra,
  };
}
