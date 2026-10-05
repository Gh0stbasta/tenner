/**
 * Recurrence arithmetic (SCHEDULING-001). Single place where due dates are derived from a frequency.
 * Dates are calendar dates (YYYY-MM-DD) in the household timezone (SCHEDULING-008).
 */

import { WEEKDAYS, type FrequencyUnit, type Weekday } from "../models/index.js";
import { addDays } from "./clock.js";

/** Approximate days per unit, for frequencyDays (analytics ratios only). */
export const APPROXIMATE_DAYS_PER_UNIT: Readonly<Record<FrequencyUnit, number>> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** Longest allowed recurrence, in (approximate) days. */
export const MAX_FREQUENCY_DAYS = 3650;

/** A Tenner's recurrence. */
export interface Frequency {
  readonly frequencyUnit: FrequencyUnit;
  readonly frequencyInterval: number;
  /** WEEK only (SCHEDULING-002); null or absent = plain completion-based weeks. */
  readonly weekdays?: readonly Weekday[] | null;
}

/**
 * frequencyDays for a unit and interval: exact for DAY/WEEK, approximate for MONTH/YEAR. With weekdays, the
 * average gap (7 × interval / number of weekdays, rounded, at least 1), e.g. Tue + Fri → 4 (SCHEDULING-002).
 */
export function approximateFrequencyDays(unit: FrequencyUnit, interval: number, weekdays?: readonly Weekday[] | null): number {
  const days = APPROXIMATE_DAYS_PER_UNIT[unit] * interval;
  if (unit !== "WEEK" || !weekdays || weekdays.length === 0) return days;
  return Math.max(1, Math.round(days / weekdays.length));
}

/**
 * Next due date after a completion on `completedDate`.
 * Month and year steps keep the calendar day and clamp to the last day of the target month
 * (2026-01-31 + 1 MONTH → 2026-02-28; 2028-02-29 + 1 YEAR → 2029-02-28).
 * Weekday-bound weeks (SCHEDULING-002): the first date after completedDate + (interval − 1) weeks whose weekday
 * is listed (every Saturday, completed Mon 2026-10-05 → Sat 2026-10-10).
 */
export function calculateNextDue(completedDate: string, unit: FrequencyUnit, interval: number, weekdays?: readonly Weekday[] | null): string {
  switch (unit) {
    case "DAY":
      return addDays(completedDate, interval);
    case "WEEK":
      return weekdays && weekdays.length > 0 ? nextWeekdayAfter(addDays(completedDate, (interval - 1) * 7), weekdays) : addDays(completedDate, interval * 7);
    case "MONTH":
      return addMonths(completedDate, interval);
    case "YEAR":
      return addMonths(completedDate, interval * 12);
  }
}

/** Add calendar months to YYYY-MM-DD, clamping the day to the target month's length. */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const monthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** ISO weekday (MON..SUN) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): Weekday {
  const sundayFirst = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[(sundayFirst + 6) % 7] as Weekday;
}

/** The first date strictly after `date` whose weekday is in `weekdays` (within the next 7 days). */
function nextWeekdayAfter(date: string, weekdays: readonly Weekday[]): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(date, offset);
    if (weekdays.includes(weekdayOf(candidate))) return candidate;
  }
  throw new Error("weekdays must not be empty.");
}
