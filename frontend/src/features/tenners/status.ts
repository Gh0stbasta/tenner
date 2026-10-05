/** Display status of a Tenner (FRONTEND-003). */

import { FREQUENCY_UNIT_LABELS, WEEKDAY_LABELS } from "../../types/domain";
import { daysBetween } from "../../utils/dates";
import { formatDueIn, formatOverdue, formatShortDate } from "../../utils/format";
import type { Vacation } from "../household/api";
import { isPaused, pausedUntil } from "../pause/pauseStatus";
import type { Tenner } from "./schemas";

const NAMED_FREQUENCIES: Readonly<Record<string, string>> = {
  "DAY:1": "Täglich",
  "DAY:7": "Wöchentlich",
  "WEEK:1": "Wöchentlich",
  "MONTH:1": "Monatlich",
  "MONTH:3": "Vierteljährlich",
  "MONTH:6": "Halbjährlich",
  "YEAR:1": "Jährlich",
};

/** Human-readable frequency (SCHEDULING-001/002): "Täglich", "Alle 14 Tage", "Monatlich", "Wöchentlich (Di, Fr)". */
export function frequencyLabel({
  frequencyUnit,
  frequencyInterval,
  weekdays = null,
}: Pick<Tenner, "frequencyUnit" | "frequencyInterval"> & Partial<Pick<Tenner, "weekdays">>): string {
  if (frequencyUnit === "WEEK" && weekdays !== null && weekdays.length > 0) {
    const days = weekdays.map((day) => WEEKDAY_LABELS[day]).join(", ");
    return frequencyInterval === 1 ? `Wöchentlich (${days})` : `Alle ${frequencyInterval} Wochen (${days})`;
  }
  const named = NAMED_FREQUENCIES[`${frequencyUnit}:${frequencyInterval}`];
  if (named !== undefined) return named;
  // Every interval of 1 is named above.
  return `Alle ${frequencyInterval} ${FREQUENCY_UNIT_LABELS[frequencyUnit]}`;
}

export type TennerStatusKind = "archived" | "inactive" | "paused" | "overdue" | "dueToday" | "upcoming";

export interface TennerStatus {
  readonly kind: TennerStatusKind;
  readonly label: string;
}

/** Display status; a pause (individual or vacation, SCHEDULING-005) wins over due dates. */
export function tennerStatus(
  tenner: Pick<Tenner, "deletedAt" | "active" | "nextDue" | "category" | "pausedAt" | "pausedUntil">,
  today: string,
  vacation: Vacation | null = null,
): TennerStatus {
  if (tenner.deletedAt !== null) return { kind: "archived", label: "Archiviert" };
  if (!tenner.active) return { kind: "inactive", label: "Inaktiv" };
  if (isPaused(tenner, vacation, today)) {
    const until = pausedUntil(tenner, vacation, today);
    return { kind: "paused", label: until === null ? "Pausiert" : `Pausiert bis ${formatShortDate(until)}` };
  }
  const days = daysBetween(today, tenner.nextDue);
  if (days < 0) return { kind: "overdue", label: formatOverdue(-days) };
  if (days === 0) return { kind: "dueToday", label: "Heute fällig" };
  return { kind: "upcoming", label: formatDueIn(days) };
}
