/** Pause rules (SCHEDULING-005). Mirrors backend/src/utils/pause.ts; dates are household-local YYYY-MM-DD. */

import type { Vacation } from "../household/api";
import type { Tenner } from "../tenners/schemas";

type PauseFields = Pick<Tenner, "category" | "pausedAt" | "pausedUntil">;

export function isPausedIndividually(tenner: Pick<Tenner, "pausedAt" | "pausedUntil">, today: string): boolean {
  return tenner.pausedAt !== null && (tenner.pausedUntil === null || tenner.pausedUntil >= today);
}

export function isOnVacation(tenner: Pick<Tenner, "category">, vacation: Vacation | null, today: string): boolean {
  if (!vacation || today < vacation.from || today > vacation.until) return false;
  return vacation.categories === null || vacation.categories.includes(tenner.category);
}

export function isPaused(tenner: PauseFields, vacation: Vacation | null, today: string): boolean {
  return isPausedIndividually(tenner, today) || isOnVacation(tenner, vacation, today);
}

/** Last paused day, or null for an open-ended pause (only meaningful while paused). */
export function pausedUntil(tenner: PauseFields, vacation: Vacation | null, today: string): string | null {
  const individual = isPausedIndividually(tenner, today);
  if (individual && tenner.pausedUntil === null) return null;
  const ends = [
    individual ? tenner.pausedUntil : null,
    isOnVacation(tenner, vacation, today) ? (vacation?.until ?? null) : null,
  ];
  return (
    ends
      .filter((end): end is string => end !== null)
      .sort()
      .at(-1) ?? null
  );
}
