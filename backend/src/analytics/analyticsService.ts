/**
 * Analytics endpoints (ANALYTICS-001 ff.): aggregates on the fly from tenner-history (completedAt-index) and the
 * current Tenners. Household volume is small; pre-aggregation is ANALYTICS-010.
 */

import type { AnalyticsPeriodRequest, AnalyticsSummaryResponse, AnalyticsTrendsRequest, AnalyticsTrendsResponse, AnalyticsUsersResponse, AnalyticsCategoriesResponse, AnalyticsNeglectedRequest, AnalyticsNeglectedResponse, AnalyticsBalanceResponse, AnalyticsHabitResponse, AnalyticsHabitsResponse, AnalyticsTimeResponse, HouseholdResponse } from "../dto/index.js";
import { SEED_CATEGORIES, SEED_MEMBERS, type HouseholdCategory, type HouseholdMember, type Tenner } from "../models/index.js";
import type { CompletionRepository, TennerRepository } from "../repositories/index.js";
import { addDays, type Clock } from "../utils/clock.js";
import { NotFoundError } from "../exceptions/index.js";
import { dateInTimeZone } from "../utils/timezone.js";
import { balance, categoryMetrics, filterCompletions, summarize, timeInvestment, trends, userMetrics, type AnalyticsContext } from "./aggregations.js";
import { loadCompletions } from "./historyLoader.js";
import { habitDetail, habits, STREAK_WINDOW_DAYS, type HabitInput } from "./habits.js";
import { DEFAULT_NEGLECTED_LIMIT, neglectedTenners } from "./neglect.js";
import { inPeriod, previousPeriod, resolvePeriod, type Period, type PeriodShortcut } from "./period.js";

/** Effective household settings (timezone, week start, vacation). */
export type HouseholdSettingsSource = (tenantId: string) => Promise<HouseholdResponse>;

interface Scope {
  readonly settings: HouseholdResponse;
  readonly period: Period;
  readonly context: AnalyticsContext;
}

export class AnalyticsService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "list" | "getById">,
    private readonly completions: Pick<CompletionRepository, "listCompletions" | "listSkips">,
    private readonly settingsOf: HouseholdSettingsSource,
    private readonly clock: Clock,
    private readonly membersOf: (tenantId: string) => Promise<readonly HouseholdMember[]> = async () => SEED_MEMBERS,
    private readonly categoriesOf: (tenantId: string) => Promise<readonly HouseholdCategory[]> = async () => SEED_CATEGORIES,
  ) {}

  async summary(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsSummaryResponse> {
    const { settings, period, context } = await this.scope(tenantId, request);
    const [completions, tenners] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.tenners.list(tenantId),
    ]);
    return summarize(completions, tenners, period, context);
  }

  /** Buckets for the period and the comparison with the previous one; one history query covers both. */
  async trends(tenantId: string, request: AnalyticsTrendsRequest): Promise<AnalyticsTrendsResponse> {
    const { settings, period } = await this.scope(tenantId, request);
    const previous = previousPeriod(period);
    const [completions, tenners] = await Promise.all([
      loadCompletions(this.completions, tenantId, { from: previous.from, to: period.to }, settings.timezone),
      this.tenners.list(tenantId, { includeDeleted: true }),
    ]);
    const matching = filterCompletions(completions, byId(tenners), { assignedTo: request.assignedTo, category: request.category });
    return trends(
      matching.filter((completion) => inPeriod(completion.date, period)),
      matching.filter((completion) => inPeriod(completion.date, previous)),
      period,
      previous,
      request.granularity ?? "week",
      settings.weekStartsOn,
    );
  }

  /** Per-member completions, minutes and current assignments (ANALYTICS-003). */
  async users(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsUsersResponse> {
    const { settings, period, context } = await this.scope(tenantId, request);
    const [completions, tenners, members] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.tenners.list(tenantId),
      this.membersOf(tenantId),
    ]);
    return userMetrics(completions, tenners, members, period, context);
  }

  /** Activity, share of minutes and health per household category (ANALYTICS-004). */
  async categories(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsCategoriesResponse> {
    const { settings, period, context } = await this.scope(tenantId, request);
    const [completions, tenners, categories] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.tenners.list(tenantId),
      this.categoriesOf(tenantId),
    ]);
    return categoryMetrics(completions, tenners, categories, period, context);
  }

  /** Most neglected active Tenners (ANALYTICS-006); default period last90, default limit 10. */
  async neglected(tenantId: string, request: AnalyticsNeglectedRequest): Promise<AnalyticsNeglectedResponse> {
    const { settings, period, context } = await this.scope(tenantId, request, "last90");
    const [completions, skips, tenners] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.completions.listSkips(tenantId, period.from, period.to),
      this.tenners.list(tenantId),
    ]);
    return {
      period: { from: period.from, to: period.to },
      items: neglectedTenners(completions, skips, tenners, period, context, settings.timezone, request.limit ?? DEFAULT_NEGLECTED_LIMIT),
    };
  }

  /** Distribution of done work and planned load between members (ANALYTICS-007). */
  async balance(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsBalanceResponse> {
    const { settings, period } = await this.scope(tenantId, request);
    const [completions, tenners, members, categories] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.tenners.list(tenantId),
      this.membersOf(tenantId),
      this.categoriesOf(tenantId),
    ]);
    return balance(completions, tenners, members, categories, period);
  }

  /** Real and projected time investment and estimate accuracy (ANALYTICS-005). */
  async time(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsTimeResponse> {
    const { settings, period } = await this.scope(tenantId, request);
    const [completions, tenners] = await Promise.all([loadCompletions(this.completions, tenantId, period, settings.timezone), this.tenners.list(tenantId)]);
    return timeInvestment(completions, tenners, period);
  }

  /** Streaks, consistency and trend of every active Tenner (ANALYTICS-008); default period last90. */
  async habits(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsHabitsResponse> {
    const [input, tenners] = await Promise.all([this.habitInput(tenantId, request), this.tenners.list(tenantId)]);
    return habits(tenners, input);
  }

  /** Habit details of one Tenner (404 for unknown or deleted Tenners). */
  async habit(tenantId: string, tennerId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsHabitResponse> {
    const [input, tenner] = await Promise.all([this.habitInput(tenantId, request), this.tenners.getById(tenantId, tennerId)]);
    if (!tenner || tenner.deletedAt !== null) throw new NotFoundError("Tenner not found.");
    return { period: { from: input.period.from, to: input.period.to }, ...habitDetail(tenner, input) };
  }

  /** One history read covering the streak window, the period and the previous period. */
  private async habitInput(tenantId: string, request: AnalyticsPeriodRequest): Promise<HabitInput> {
    const { settings, period, context } = await this.scope(tenantId, request, "last90");
    const previous = previousPeriod(period);
    const streakStart = addDays(context.today, -(STREAK_WINDOW_DAYS - 1));
    const [completions, skips] = await Promise.all([
      loadCompletions(this.completions, tenantId, { from: previous.from < streakStart ? previous.from : streakStart, to: context.today }, settings.timezone),
      this.completions.listSkips(tenantId, previous.from, period.to),
    ]);
    return { completions, skips, period, previousPeriod: previous, context, timezone: settings.timezone };
  }

  /** Settings, today and the resolved period (400 for invalid periods). */
  private async scope(tenantId: string, request: AnalyticsPeriodRequest, fallback?: PeriodShortcut): Promise<Scope> {
    const settings = await this.settingsOf(tenantId);
    const today = dateInTimeZone(this.clock(), settings.timezone);
    return { settings, period: resolvePeriod(request, today, settings.weekStartsOn, fallback), context: { today, vacation: settings.vacation } };
  }
}

const byId = (tenners: readonly Tenner[]): Map<string, Tenner> => new Map(tenners.map((tenner) => [tenner.tennerId, tenner]));
