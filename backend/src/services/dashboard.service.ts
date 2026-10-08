/**
 * Dashboard read model (TICKET-016): due today, overdue, upcoming and workload summaries in one response.
 * Two queries since SCHEDULING-005: the nextDue window and the active Tenners for the paused section.
 */

import type {
  DashboardGroupSummary,
  DashboardPausedTennerResponse,
  DashboardRequest,
  DashboardResponse,
  DashboardSummaryResponse,
  DashboardTennerResponse,
} from "../dto/index.js";
import { SEED_MEMBERS, SHARED_ASSIGNEE, startDateOf, type Tenner } from "../models/index.js";
import type { MemberSource } from "./member.service.js";
import type { TennerRepository } from "../repositories/index.js";
import { addDays, type Clock } from "../utils/clock.js";
import { isPaused, isPausedIndividually, pausedUntilOf, type VacationSource } from "../utils/pause.js";
import { dateInTimeZone, daysBetween, type TimeZoneSource } from "../utils/timezone.js";

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
    private readonly repository: Pick<TennerRepository, "getDashboardCandidates" | "list">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
    private readonly vacationOf: VacationSource,
    private readonly membersOf: MemberSource = async () => SEED_MEMBERS,
  ) {}

  async getDashboard(tenantId: string, request: DashboardRequest = {}): Promise<DashboardResponse> {
    const timezone = await this.timezoneOf(tenantId);
    const referenceDate = request.date ?? dateInTimeZone(this.clock(), timezone);
    const endDate = addDays(referenceDate, UPCOMING_DAYS);
    const vacation = await this.vacationOf(tenantId);
    const matches = (t: Tenner): boolean =>
      t.active &&
      t.deletedAt === null &&
      // A member filter includes shared Tenners (HOUSEHOLD-002).
      (request.assignedTo === undefined || t.assignedTo === request.assignedTo || t.assignedTo === SHARED_ASSIGNEE) &&
      (request.category === undefined || t.category === request.category) &&
      // HOTFIX-006: not before its start date (also not as „upcoming“).
      startDateOf(t) <= referenceDate;
    // Paused Tenners (SCHEDULING-005) leave every section and summary and get their own list.
    const candidates = (await this.repository.getDashboardCandidates(tenantId, endDate)).filter(
      (t) => matches(t) && !isPaused(t, vacation, referenceDate),
    );
    const paused = (await this.repository.list(tenantId, { active: true }))
      .filter((t) => matches(t) && isPaused(t, vacation, referenceDate))
      .sort(SORT_OVERDUE);

    const dueToday = candidates.filter((t) => t.nextDue === referenceDate).sort(SORT_DUE_TODAY);
    const overdue = candidates.filter((t) => t.nextDue < referenceDate).sort(SORT_OVERDUE);
    const upcoming = candidates.filter((t) => t.nextDue > referenceDate && t.nextDue <= endDate).sort(SORT_UPCOMING);
    const actionable = [...dueToday, ...overdue];

    return {
      referenceDate,
      timezone,
      summary: summarize(dueToday, overdue, upcoming),
      dueToday: dueToday.map((t) => toItem(t)),
      overdue: overdue.map((t) => toItem(t, { overdueDays: daysBetween(t.nextDue, referenceDate) })),
      upcoming: upcoming.map((t) => toItem(t, { daysUntilDue: daysBetween(referenceDate, t.nextDue) })),
      paused: paused.map((t): DashboardPausedTennerResponse => ({
        ...toItem(t),
        pausedUntil: pausedUntilOf(t, vacation, referenceDate),
        pauseReason: isPausedIndividually(t, referenceDate) ? "PAUSE" : "VACATION",
      })),
      byUser: groupByUser(actionable, (await this.membersOf(tenantId)).filter((member) => member.active).map((member) => member.userId)),
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

/**
 * Actionable load per member. Shared Tenners count for every active member (sharedCount) and their minutes are split
 * evenly; minutes are rounded per member (HOUSEHOLD-002).
 */
function groupByUser(tenners: readonly Tenner[], activeMembers: readonly string[]): Record<string, DashboardGroupSummary> {
  const own = groupBy(tenners.filter((t) => t.assignedTo !== SHARED_ASSIGNEE), (t) => t.assignedTo) as Record<string, DashboardGroupSummary>;
  const shared = tenners.filter((t) => t.assignedTo === SHARED_ASSIGNEE);
  if (shared.length === 0 || activeMembers.length === 0) return own;
  const sharedMinutes = minutes(shared) / activeMembers.length;
  const result: Record<string, DashboardGroupSummary> = { ...own };
  for (const userId of activeMembers) {
    const current = own[userId] ?? { count: 0, estimatedMinutes: 0 };
    result[userId] = { count: current.count + shared.length, estimatedMinutes: Math.round(current.estimatedMinutes + sharedMinutes), sharedCount: shared.length };
  }
  return result;
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
    originalAssignee: tenner.originalAssignee,
    estimatedMinutes: tenner.estimatedMinutes,
    nextDue: tenner.nextDue,
    snoozedUntil: tenner.snoozedUntil,
    ...extra,
  };
}
