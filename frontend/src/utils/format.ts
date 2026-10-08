/** German display formatting for dates, durations and counts. */

const LOCALE = "de-DE";

/** "1 Aufgabe" / "3 Aufgaben" (REC-002: Tenner are called Aufgaben in the UI). */
export function formatTennerCount(count: number): string {
  return `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;
}

/** "10 Min." */
export function formatMinutes(minutes: number): string {
  return `${minutes} Min.`;
}

/** "1 Tag" / "12 Tage" / "14,5 Tage" */
export function formatDays(days: number): string {
  return `${days.toLocaleString(LOCALE)} ${days === 1 ? "Tag" : "Tage"}`;
}

/** "heute", "gestern", "vor 13 Tagen" for a whole number of days in the past. */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "gerade eben", "vor 2 Minuten", "vor 3 Stunden", "gestern", "vor 4 Tagen", then a date. */
export function formatRelativeTime(timestamp: string, now: Date = new Date()): string {
  const then = new Date(timestamp);
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE_MS) return "gerade eben";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `vor ${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`;
  }
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `vor ${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
  }
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return then.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}
