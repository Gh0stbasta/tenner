/** API contracts for household settings (SCHEDULING-008). */

import type { Category, NewTennerDefaults, WeekStart, Weekday } from "../models/index.js";

export interface VacationResponse {
  readonly from: string;
  readonly until: string;
  /** null = all categories. */
  readonly categories: readonly Category[] | null;
}

/** Effective household settings (stored values or defaults), HOUSEHOLD-ADMIN-003. */
export interface HouseholdResponse {
  readonly name: string;
  /** IANA timezone used for all due dates of the household. */
  readonly timezone: string;
  readonly weekStartsOn: WeekStart;
  readonly workdays: readonly Weekday[];
  readonly defaults: NewTennerDefaults;
  /** "HOUSEHOLD" once the household saved its own defaults; drives the local-storage migration offer. */
  readonly defaultsSource: "DEFAULT" | "HOUSEHOLD";
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

/** PUT /household: any subset of the household settings (HOUSEHOLD-ADMIN-003). */
export interface UpdateHouseholdRequest {
  readonly name?: string | undefined;
  readonly timezone?: string | undefined;
  readonly weekStartsOn?: WeekStart | undefined;
  readonly workdays?: readonly Weekday[] | undefined;
  readonly defaults?: NewTennerDefaults | undefined;
}
