/** Quick snooze options (SCHEDULING-003). Dates are household-local calendar dates (YYYY-MM-DD). */

import { formatShortDate } from "../../utils/format";

/** Request body of POST /tenners/{tennerId}/snooze. */
export type SnoozeRequest = { readonly days: number } | { readonly until: string };

export interface SnoozeOption {
  readonly key: string;
  readonly label: string;
  readonly request: SnoozeRequest;
}

const SATURDAY = 6;

/** Calendar arithmetic on YYYY-MM-DD (timezone-independent). */
export function addDaysIso(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** The first Saturday after `today` (on a Saturday or Sunday: the following weekend). */
export function nextWeekend(today: string): string {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDaysIso(today, (SATURDAY - weekday + 7) % 7 || 7);
}

export function snoozeOptions(today: string): readonly SnoozeOption[] {
  const weekend = nextWeekend(today);
  return [
    { key: "tomorrow", label: "Morgen", request: { days: 1 } },
    { key: "three-days", label: "In 3 Tagen", request: { days: 3 } },
    { key: "weekend", label: `Nächstes Wochenende (${formatShortDate(weekend)})`, request: { until: weekend } },
  ];
}

/** The date a request moves the Tenner to. */
export function snoozeTarget(request: SnoozeRequest, today: string): string {
  return "until" in request ? request.until : addDaysIso(today, request.days);
}
