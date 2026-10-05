/** Calendar-date helpers in the household timezone (SCHEDULING-008) or, as fallback, the browser's timezone. */

import { parseIsoDate } from "./format";

const DAY_MS = 86_400_000;

/** Calendar date (YYYY-MM-DD) of `now` in `timeZone`; without a timezone in the browser's local time. */
export function todayIsoDate(now: Date = new Date(), timeZone?: string): string {
  if (timeZone !== undefined) {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      now,
    );
  }
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}
