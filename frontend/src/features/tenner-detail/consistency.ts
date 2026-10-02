/** Lightweight consistency indicator, computed from the loaded history (FRONTEND-009). */

import type { HistoryItem } from "../completions/api";

const DAY_MS = 86_400_000;
export const CONSISTENCY_WINDOW_DAYS = 90;

export interface Consistency {
  /** Completions within the last 90 days. */
  readonly recentCount: number;
  /** Average days between consecutive completions; undefined with fewer than two completions. */
  readonly averageIntervalDays: number | undefined;
}

export function computeConsistency(items: readonly HistoryItem[], now: Date = new Date()): Consistency {
  const times = items
    .filter((item) => item.revertedAt === null)
    .map((item) => new Date(item.completedAt).getTime())
    .sort((a, b) => a - b);
  const windowStart = now.getTime() - CONSISTENCY_WINDOW_DAYS * DAY_MS;
  const recentCount = times.filter((time) => time >= windowStart).length;
  if (times.length < 2) return { recentCount, averageIntervalDays: undefined };
  const first = times[0] ?? 0;
  const last = times[times.length - 1] ?? 0;
  return { recentCount, averageIntervalDays: Math.round(((last - first) / DAY_MS / (times.length - 1)) * 10) / 10 };
}
