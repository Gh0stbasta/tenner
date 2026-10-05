/** API contracts for household settings (SCHEDULING-008). */

export interface HouseholdResponse {
  /** IANA timezone used for all due dates of the household. */
  readonly timezone: string;
}

export interface UpdateHouseholdRequest {
  readonly timezone: string;
}
