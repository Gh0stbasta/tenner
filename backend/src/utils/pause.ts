/**
 * Pause and vacation rules (SCHEDULING-005). Pauses are evaluated at read time against "today" in the household
 * timezone, so a pause with an end date ends on its own without a scheduler. Due dates are moved when a pause or
 * vacation is set (and on manual resume), never by a background job.
 */

import type { Tenner, Vacation } from "../models/index.js";
import { addDays } from "./clock.js";

/** Daily load cap after a pause: average daily load + 50 %. */
export const RESUME_LOAD_FACTOR = 1.5;

/** True while the household vacation covers `today` and the Tenner's category. */
export function isOnVacation(tenner: Pick<Tenner, "category">, vacation: Vacation | null, today: string): boolean {
  if (!vacation || today < vacation.from || today > vacation.until) return false;
  return vacation.categories === null || vacation.categories.includes(tenner.category);
}

/** True while the Tenner is paused individually (open-ended, or until a date that has not passed). */
export function isPausedIndividually(tenner: Pick<Tenner, "pausedAt" | "pausedUntil">, today: string): boolean {
  return tenner.pausedAt !== null && (tenner.pausedUntil === null || tenner.pausedUntil >= today);
}

/** Effective pause: individual or vacation. */
export function isPaused(tenner: Pick<Tenner, "category" | "pausedAt" | "pausedUntil">, vacation: Vacation | null, today: string): boolean {
  return isPausedIndividually(tenner, today) || isOnVacation(tenner, vacation, today);
}

/**
 * Last paused day for display: the later of an individual end date and a vacation end; null = open-ended.
 * Only meaningful while isPaused is true.
 */
export function pausedUntilOf(tenner: Pick<Tenner, "category" | "pausedAt" | "pausedUntil">, vacation: Vacation | null, today: string): string | null {
  const individual = isPausedIndividually(tenner, today);
  if (individual && tenner.pausedUntil === null) return null;
  const ends = [individual ? tenner.pausedUntil : null, isOnVacation(tenner, vacation, today) ? (vacation?.until ?? null) : null];
  return ends.filter((end): end is string => end !== null).sort().at(-1) ?? null;
}

/** Tenners a vacation moves: due within the vacation, or already overdue when it has started. */
export function affectedByVacation(tenner: Pick<Tenner, "category" | "nextDue">, vacation: Vacation, today: string): boolean {
  if (vacation.categories !== null && !vacation.categories.includes(tenner.category)) return false;
  if (tenner.nextDue > vacation.until) return false;
  return tenner.nextDue >= vacation.from || vacation.from <= today;
}

/** A new due date (completion, skip) that lands inside the vacation moves to the day after it. */
export function avoidVacation(nextDue: string, tenner: Pick<Tenner, "category">, vacation: Vacation | null): string {
  if (!vacation || nextDue < vacation.from || nextDue > vacation.until) return nextDue;
  if (vacation.categories !== null && !vacation.categories.includes(tenner.category)) return nextDue;
  return addDays(vacation.until, 1);
}

/** Expected minutes per day of the active Tenners (Σ estimatedMinutes / frequencyDays). */
export function averageDailyLoad(tenners: readonly Pick<Tenner, "estimatedMinutes" | "frequencyDays">[]): number {
  return tenners.reduce((sum, tenner) => sum + tenner.estimatedMinutes / Math.max(1, tenner.frequencyDays), 0);
}

/**
 * Spread resumed Tenners over the days from `resumeDate` on, oldest due first, so that no day exceeds `cap`
 * minutes including the Tenners already due then (`existing`). A day always takes at least one Tenner, so long
 * Tenners are never pushed out indefinitely. Returns tennerId → new nextDue.
 */
export function distributeResume(
  moved: readonly Pick<Tenner, "tennerId" | "nextDue" | "title" | "estimatedMinutes">[],
  existing: readonly Pick<Tenner, "nextDue" | "estimatedMinutes">[],
  resumeDate: string,
  cap: number,
): Map<string, string> {
  const load = new Map<string, number>();
  for (const tenner of existing) load.set(tenner.nextDue, (load.get(tenner.nextDue) ?? 0) + tenner.estimatedMinutes);
  const order = [...moved].sort((a, b) => (a.nextDue === b.nextDue ? a.title.localeCompare(b.title) : a.nextDue < b.nextDue ? -1 : 1));
  const assignments = new Map<string, string>();
  for (const tenner of order) {
    let day = resumeDate;
    while ((load.get(day) ?? 0) > 0 && (load.get(day) ?? 0) + tenner.estimatedMinutes > cap) day = addDays(day, 1);
    load.set(day, (load.get(day) ?? 0) + tenner.estimatedMinutes);
    assignments.set(tenner.tennerId, day);
  }
  return assignments;
}

/** The household's vacation, or null (SCHEDULING-005). */
export type VacationSource = (tenantId: string) => Promise<Vacation | null>;
