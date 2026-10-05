/** API contracts for household settings (SCHEDULING-008). */

import type { Category } from "../models/index.js";

export interface VacationResponse {
  readonly from: string;
  readonly until: string;
  /** null = all categories. */
  readonly categories: readonly Category[] | null;
}

export interface HouseholdResponse {
  /** IANA timezone used for all due dates of the household. */
  readonly timezone: string;
  /** Household vacation (SCHEDULING-005), or null. */
  readonly vacation: VacationResponse | null;
}

/** PUT /household/vacation (SCHEDULING-005). */
export interface VacationRequest {
  readonly from: string;
  readonly until: string;
  readonly categories?: readonly Category[] | undefined;
}

export interface VacationUpdateResponse {
  readonly household: HouseholdResponse;
  /** Tenners whose due date moved behind the vacation. */
  readonly rescheduled: number;
  /** Tenners skipped because they changed concurrently (they keep their due date). */
  readonly conflicts: number;
}

export interface UpdateHouseholdRequest {
  readonly timezone: string;
}
