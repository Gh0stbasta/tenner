/** API contracts for household settings (SCHEDULING-008). */

import type { Category, NewTennerDefaults, UserId, WeekStart, Weekday } from "../models/index.js";

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
  /** Running handovers (HOUSEHOLD-004); expired ones are given back on the next read. */
  readonly handovers: readonly HandoverResponse[];
}

export interface HandoverResponse {
  readonly from: UserId;
  readonly to: UserId;
  /** Last day of the handover (inclusive, household-local date). */
  readonly until: string;
  /** null = all categories. */
  readonly categories: readonly Category[] | null;
}

/** POST /users/{userId}/handover (HOUSEHOLD-004). */
export interface StartHandoverRequest {
  readonly to: UserId;
  readonly until: string;
  readonly categories?: readonly Category[] | undefined;
}

export interface StartHandoverResponse {
  readonly handover: HandoverResponse;
  /** Tenners now assigned to `to`. */
  readonly handedOver: number;
}

/** DELETE /users/{userId}/handover. */
export interface EndHandoverResponse {
  /** Tenners given back to the member. */
  readonly returned: number;
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
