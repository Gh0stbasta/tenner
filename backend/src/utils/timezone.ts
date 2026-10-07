/** Calendar-date helpers in an IANA timezone (independent of the Lambda runtime's TZ). */

export const DEFAULT_TIMEZONE = "Europe/Berlin";

/** True if the runtime knows the IANA timezone. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Household timezone of a tenant (SCHEDULING-008). Every "today" and every completion date is a calendar date in
 * this timezone. Resolved per request; falls back to the configured default when the household has none.
 */
export type TimeZoneSource = (tenantId: string) => Promise<string>;

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (Berlin summer: 120). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** The instant of local `date` (YYYY-MM-DD) and `time` (HH:mm) in `timeZone` (NOTIFICATION-011 snooze times). */
export function localDateTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  // Two passes settle the offset also next to a DST switch.
  let instant = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  instant = wall - offsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}
