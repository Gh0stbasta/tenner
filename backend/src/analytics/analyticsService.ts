/**
 * Analytics endpoints (ANALYTICS-001 ff.): aggregates on the fly from tenner-history (completedAt-index) and the
 * current Tenners. Household volume is small; pre-aggregation is ANALYTICS-010.
 */

import type { AnalyticsPeriodRequest, AnalyticsSummaryResponse, AnalyticsTrendsRequest, AnalyticsTrendsResponse, AnalyticsUsersResponse, AnalyticsCategoriesResponse, HouseholdResponse } from "../dto/index.js";
import { SEED_CATEGORIES, SEED_MEMBERS, type HouseholdCategory, type HouseholdMember, type Tenner } from "../models/index.js";
import type { CompletionRepository, TennerRepository } from "../repositories/index.js";
import type { Clock } from "../utils/clock.js";
import { dateInTimeZone } from "../utils/timezone.js";
import { categoryMetrics, filterCompletions, summarize, trends, userMetrics, type AnalyticsContext } from "./aggregations.js";
import { loadCompletions } from "./historyLoader.js";
import { inPeriod, previousPeriod, resolvePeriod, type Period } from "./period.js";

/** Effective household settings (timezone, week start, vacation). */
export type HouseholdSettingsSource = (tenantId: string) => Promise<HouseholdResponse>;

interface Scope {
  readonly settings: HouseholdResponse;
  readonly period: Period;
  readonly context: AnalyticsContext;
}

export class AnalyticsService {
  constructor(
    private readonly tenners: Pick<TennerRepository, "list">,
    private readonly completions: Pick<CompletionRepository, "listCompletions">,
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

  /** Settings, today and the resolved period (400 for invalid periods). */
  private async scope(tenantId: string, request: AnalyticsPeriodRequest): Promise<Scope> {
    const settings = await this.settingsOf(tenantId);
    const today = dateInTimeZone(this.clock(), settings.timezone);
    return { settings, period: resolvePeriod(request, today, settings.weekStartsOn), context: { today, vacation: settings.vacation } };
  }
}

const byId = (tenners: readonly Tenner[]): Map<string, Tenner> => new Map(tenners.map((tenner) => [tenner.tennerId, tenner]));
