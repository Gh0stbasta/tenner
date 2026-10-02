/** Display status of a Tenner (FRONTEND-003). */

import { daysBetween } from "../../utils/dates";
import { formatDueIn, formatOverdue } from "../../utils/format";
import type { Tenner } from "./schemas";

/** "Täglich", "Wöchentlich", "Alle 14 Tage". */
export function frequencyLabel(days: number): string {
  if (days === 1) return "Täglich";
  if (days === 7) return "Wöchentlich";
  return `Alle ${days} Tage`;
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
