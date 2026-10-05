import type { Category } from "./enums.js";

/**
 * Household vacation (SCHEDULING-005): Tenners of the listed categories (null = all) are paused from `from` to
 * `until` (inclusive, household-local dates).
 */
export interface Vacation {
  readonly from: string;
  readonly until: string;
  readonly categories: readonly Category[] | null;
}
