import type { UserId } from "./enums.js";

/** Household-level settings (one item per tenant in tenner-households; SCHEDULING-008, extended by HOUSEHOLD-ADMIN-003). */
export interface HouseholdSettings {
  readonly tenantId: string;
  /** IANA timezone; every "today" and completion date is a calendar date in this zone. */
  readonly timezone: string;
  readonly updatedAt: string;
  readonly updatedBy: UserId | null;
}
