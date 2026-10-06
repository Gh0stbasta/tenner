/** Shared wording for written notifications (NOTIFICATION-003/004), German like the app. */

/** „Guten Morgen“ before 11:00 local, „Guten Tag“ before 17:00, otherwise „Guten Abend“. */
export function greeting(localMinutes: number): string {
  if (localMinutes < 11 * 60) return "Guten Morgen";
  if (localMinutes < 17 * 60) return "Guten Tag";
  return "Guten Abend";
}

/** „1 Tenner“ / „3 Tenner“ — Tenner has the same plural. */
export const tenners = (count: number): string => `${count} Tenner`;

/** „ — 1 Tag“ / „ — 3 Tage“ */
export const daysText = (days: number): string => `${days} ${days === 1 ? "Tag" : "Tage"}`;

/** Bullet list with at most `limit` items and „+N weitere“. */
export function bulletList(items: readonly string[], limit: number): string[] {
  const lines = items.slice(0, limit).map((item) => `• ${item}`);
  if (items.length > limit) lines.push(`+${items.length - limit} weitere`);
  return lines;
}
