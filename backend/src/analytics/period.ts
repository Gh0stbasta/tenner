/**
 * Analytics periods (ANALYTICS-001): `period` shortcut or `from`/`to`, as household-local calendar dates, inclusive.
 * Pure functions; "today" and the week start are passed in.
 */

import { ValidationError } from "../exceptions/index.js";
import { WEEKDAYS, type WeekStart } from "../models/index.js";
import { addDays } from "../utils/clock.js";
import { weekdayOf } from "../utils/schedule.js";
import { daysBetween } from "../utils/timezone.js";

export const PERIOD_SHORTCUTS = ["week", "month", "quarter", "year", "last30", "last90"] as const;
export type PeriodShortcut = (typeof PERIOD_SHORTCUTS)[number];

export const DEFAULT_PERIOD: PeriodShortcut = "last30";
/** Longest allowed period (a leap year). */
export const MAX_PERIOD_DAYS = 366;

/** Inclusive household-local date range. */
export interface Period {
  readonly from: string;
  readonly to: string;
  /** Number of days, including both ends. */
  readonly days: number;
}

export interface PeriodRequest {
  readonly period?: PeriodShortcut | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

const invalid = (field: string, message: string) => new ValidationError("Invalid analytics period.", [{ field, message }]);

const periodOf = (from: string, to: string): Period => ({ from, to, days: daysBetween(from, to) + 1 });

/** First day of the week containing `date`. */
export function startOfWeek(date: string, weekStartsOn: WeekStart): string {
  const offset = WEEKDAYS.indexOf(weekdayOf(date));
  return addDays(date, -(weekStartsOn === "MONDAY" ? offset : (offset + 1) % 7));
}

export const startOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

function startOfQuarter(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-${String(month - ((month - 1) % 3)).padStart(2, "0")}-01`;
}

/** The shortcut's range, ending today ("week" = the current week so far). */
function shortcutPeriod(shortcut: PeriodShortcut, today: string, weekStartsOn: WeekStart): Period {
  switch (shortcut) {
    case "week":
      return periodOf(startOfWeek(today, weekStartsOn), today);
    case "month":
      return periodOf(startOfMonth(today), today);
    case "quarter":
      return periodOf(startOfQuarter(today), today);
    case "year":
      return periodOf(`${today.slice(0, 4)}-01-01`, today);
    case "last30":
      return periodOf(addDays(today, -29), today);
    case "last90":
      return periodOf(addDays(today, -89), today);
  }
}

/**
 * Resolve the requested period. Rules: either `period` or `from`/`to`; `to` in the future is clamped to today;
 * only `from` → until today; only `to` → the 30 days ending there; `from <= to`; at most 366 days.
 */
export function resolvePeriod(request: PeriodRequest, today: string, weekStartsOn: WeekStart, fallback: PeriodShortcut = DEFAULT_PERIOD): Period {
  if (request.period !== undefined && (request.from !== undefined || request.to !== undefined)) {
    throw invalid("period", "Use either period or from/to.");
  }
  if (request.from === undefined && request.to === undefined) return shortcutPeriod(request.period ?? fallback, today, weekStartsOn);
  const to = request.to === undefined || request.to > today ? today : request.to;
  const from = request.from ?? addDays(to, -29);
  if (from > to) throw invalid("from", request.from !== undefined && request.from > today ? "Must not be in the future." : "Must not be after to.");
  const period = periodOf(from, to);
  if (period.days > MAX_PERIOD_DAYS) throw invalid("from", `The period must not exceed ${MAX_PERIOD_DAYS} days.`);
  return period;
}

/** The period of equal length immediately before. */
export function previousPeriod(period: Period): Period {
  const to = addDays(period.from, -1);
  return periodOf(addDays(to, -(period.days - 1)), to);
}

/** True if the date lies in the period. */
export const inPeriod = (date: string, period: Pick<Period, "from" | "to">): boolean => date >= period.from && date <= period.to;

/** Each calendar date of the period, oldest first. */
export function datesOf(period: Pick<Period, "from" | "to">): string[] {
  const dates: string[] = [];
  for (let date = period.from; date <= period.to; date = addDays(date, 1)) dates.push(date);
  return dates;
}
