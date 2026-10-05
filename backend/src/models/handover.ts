import type { Category, UserId } from "./enums.js";

/**
 * Temporary handover (HOUSEHOLD-004): the Tenners of `from` (of the listed categories, null = all) are assigned to
 * `to` until `until` (inclusive, household-local date) and then given back. At most one handover per member.
 */
export interface Handover {
  readonly from: UserId;
  readonly to: UserId;
  readonly until: string;
  readonly categories: readonly Category[] | null;
  readonly createdAt: string;
  readonly createdBy: UserId;
}

/** True while the handover lasts (until is inclusive). */
export function isHandoverActive(handover: Handover, today: string): boolean {
  return handover.until >= today;
}

/** True if the handover moves Tenners of this category. */
export function handoverCovers(handover: Handover, category: Category): boolean {
  return handover.categories === null || handover.categories.includes(category);
}

/** The active handover of `userId` that covers `category`, if any. */
export function activeHandoverFor(handovers: readonly Handover[], userId: UserId, category: Category, today: string): Handover | undefined {
  return handovers.find((handover) => handover.from === userId && isHandoverActive(handover, today) && handoverCovers(handover, category));
}
