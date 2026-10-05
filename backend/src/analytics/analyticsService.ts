/**
 * Analytics endpoints (ANALYTICS-001 ff.): aggregates on the fly from tenner-history (completedAt-index) and the
 * current Tenners. Household volume is small; pre-aggregation is ANALYTICS-010.
 */

import type { AnalyticsPeriodRequest, AnalyticsSummaryResponse, HouseholdResponse } from "../dto/index.js";
import type { CompletionRepository, TennerRepository } from "../repositories/index.js";
import type { Clock } from "../utils/clock.js";
import { dateInTimeZone } from "../utils/timezone.js";
import { summarize, type AnalyticsContext } from "./aggregations.js";
import { loadCompletions } from "./historyLoader.js";
import { resolvePeriod, type Period } from "./period.js";

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
  ) {}

  async summary(tenantId: string, request: AnalyticsPeriodRequest): Promise<AnalyticsSummaryResponse> {
    const { settings, period, context } = await this.scope(tenantId, request);
    const [completions, tenners] = await Promise.all([
      loadCompletions(this.completions, tenantId, period, settings.timezone),
      this.tenners.list(tenantId),
    ]);
    return summarize(completions, tenners, period, context);
  }

  /** Settings, today and the resolved period (400 for invalid periods). */
  private async scope(tenantId: string, request: AnalyticsPeriodRequest): Promise<Scope> {
    const settings = await this.settingsOf(tenantId);
    const today = dateInTimeZone(this.clock(), settings.timezone);
    return { settings, period: resolvePeriod(request, today, settings.weekStartsOn), context: { today, vacation: settings.vacation } };
  }
}
