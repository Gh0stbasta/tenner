/** Job timing (NOTIFICATION-001): the notifier runs every 15 minutes; a job is due in the window containing its time. */

export const RUN_INTERVAL_MINUTES = 15;

/** Local date (YYYY-MM-DD), minutes since midnight and ISO weekday (1 = Monday) of `now` in `timeZone`. */
export function localTime(now: Date, timeZone: string): { date: string; minutes: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday ?? "") + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday };
}

/** "HH:mm" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * True when `time` (HH:mm, local) falls into the run window [now - interval, now] rounded to the schedule grid.
 * A run at 07:30:20 covers 07:30–07:44; a delayed run still sends because deduplication prevents doubles.
 */
export function isDueAt(time: string, now: Date, timeZone: string, intervalMinutes = RUN_INTERVAL_MINUTES): boolean {
  const { minutes } = localTime(now, timeZone);
  const windowStart = minutes - (minutes % intervalMinutes);
  const target = minutesOf(time);
  return target >= windowStart && target < windowStart + intervalMinutes;
}

/** True when `now` is inside quiet hours [start, end) — ranges may wrap midnight (21:30–07:00). */
export function inQuietHours(quiet: { start: string; end: string } | null, now: Date, timeZone: string): boolean {
  if (quiet === null) return false;
  const { minutes } = localTime(now, timeZone);
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
