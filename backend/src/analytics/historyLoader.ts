/** Loads the completions of an analytics period (ANALYTICS-001). */

import type { Completion } from "../models/index.js";
import type { CompletionRepository } from "../repositories/index.js";
import { addDays } from "../utils/clock.js";
import { dateInTimeZone } from "../utils/timezone.js";
import { inPeriod, type Period } from "./period.js";

/** A completion with its household-local calendar date. */
export interface AnalyticsCompletion extends Completion {
  readonly date: string;
}

/**
 * Non-reverted completions whose household-local date lies in the period, oldest first. The UTC query window is one
 * day wider on each side (timezones are at most ±14 h off UTC); the exact cut happens on the local date.
 */
export async function loadCompletions(
  repository: Pick<CompletionRepository, "listCompletions">,
  tenantId: string,
  period: Pick<Period, "from" | "to">,
  timezone: string,
): Promise<AnalyticsCompletion[]> {
  const completions = await repository.listCompletions(tenantId, `${addDays(period.from, -1)}T00:00:00Z`, `${addDays(period.to, 2)}T00:00:00Z`);
  return completions
    .map((completion) => ({ ...completion, date: dateInTimeZone(new Date(completion.completedAt), timezone) }))
    .filter((completion) => inPeriod(completion.date, period))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}
