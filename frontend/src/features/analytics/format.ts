/** Formatting and scale helpers of the analytics page (ANALYTICS-009). */

import { formatShortDate, parseIsoDate } from "../../utils/format";
import type { AnalyticsTrends } from "./api";

const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short" });
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric" });

/** A clean axis maximum (1, 2, 5 × 10ⁿ) at or above the largest value. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** "86 %" (German format); "–" for null. */
export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)} %`;
}

/** Axis label and accessible description of a trend bucket. */
export function bucketLabel(
  start: string,
  granularity: AnalyticsTrends["granularity"],
): { short: string; long: string } {
  const date = parseIsoDate(start);
  if (granularity === "month")
    return { short: MONTH.format(date), long: date.toLocaleDateString("de-DE", { month: "long", year: "numeric" }) };
  if (granularity === "week") return { short: DAY.format(date), long: `Woche ab ${formatShortDate(start)}` };
  return { short: DAY.format(date), long: formatShortDate(start) };
}
