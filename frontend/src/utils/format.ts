/** German display formatting for dates, durations and counts. */

const LOCALE = "de-DE";

/** "1 Tenner" / "3 Tenner" – the word is the same in singular and plural. */
export function formatTennerCount(count: number): string {
  return `${count} Tenner`;
}

/** "10 Min." */
export function formatMinutes(minutes: number): string {
  return `${minutes} Min.`;
}

/** "1 Tag" / "12 Tage" */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "Tag" : "Tage"}`;
}

/** Parse a YYYY-MM-DD calendar date as a local date (no timezone shift). */
export function parseIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** "Fr., 2. Okt." */
export function formatShortDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
}

/** "Freitag, 2. Oktober" */
export function formatLongDate(isoDate: string): string {
  return parseIsoDate(isoDate).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
}

/** "seit 1 Tag überfällig" / "seit 12 Tagen überfällig" (dative plural). */
export function formatOverdue(days: number): string {
  return `seit ${days} ${days === 1 ? "Tag" : "Tagen"} überfällig`;
}

/** "morgen fällig" / "fällig in 3 Tagen" */
export function formatDueIn(days: number): string {
  if (days <= 0) return "heute fällig";
  if (days === 1) return "morgen fällig";
  return `fällig in ${days} Tagen`;
}
