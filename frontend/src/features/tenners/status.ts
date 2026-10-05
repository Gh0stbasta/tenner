/** Display status of a Tenner (FRONTEND-003). */

import { FREQUENCY_UNIT_LABELS } from "../../types/domain";
import { daysBetween } from "../../utils/dates";
import { formatDueIn, formatOverdue } from "../../utils/format";
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

/** Human-readable frequency (SCHEDULING-001): "Täglich", "Alle 14 Tage", "Monatlich", "Alle 2 Jahre". */
export function frequencyLabel({
  frequencyUnit,
  frequencyInterval,
}: Pick<Tenner, "frequencyUnit" | "frequencyInterval">): string {
  const named = NAMED_FREQUENCIES[`${frequencyUnit}:${frequencyInterval}`];
  if (named !== undefined) return named;
  // Every interval of 1 is named above.
  return `Alle ${frequencyInterval} ${FREQUENCY_UNIT_LABELS[frequencyUnit]}`;
}

export type TennerStatusKind = "archived" | "inactive" | "overdue" | "dueToday" | "upcoming";

export interface TennerStatus {
  readonly kind: TennerStatusKind;
  readonly label: string;
}

export function tennerStatus(tenner: Pick<Tenner, "deletedAt" | "active" | "nextDue">, today: string): TennerStatus {
  if (tenner.deletedAt !== null) return { kind: "archived", label: "Archiviert" };
  if (!tenner.active) return { kind: "inactive", label: "Inaktiv" };
  const days = daysBetween(today, tenner.nextDue);
  if (days < 0) return { kind: "overdue", label: formatOverdue(-days) };
  if (days === 0) return { kind: "dueToday", label: "Heute fällig" };
  return { kind: "upcoming", label: formatDueIn(days) };
}
