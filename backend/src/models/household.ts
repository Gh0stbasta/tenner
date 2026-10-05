import type { Category, UserId, WeekStart, Weekday } from "./enums.js";
import type { HouseholdCategory } from "./category.js";
import type { Handover } from "./handover.js";
import type { HouseholdMember } from "./user.js";
import type { Vacation } from "./vacation.js";

/** Household-level settings (one item per tenant in tenner-households; SCHEDULING-008, extended by HOUSEHOLD-ADMIN-003). */
export interface HouseholdSettings {
  readonly tenantId: string;
  /** Display name of the household (HOUSEHOLD-ADMIN-003); null = default. */
  readonly name: string | null;
  /** IANA timezone; every "today" and completion date is a calendar date in this zone. Null = default. */
  readonly timezone: string | null;
  /** HOUSEHOLD-ADMIN-003; null = default (Monday). */
  readonly weekStartsOn: WeekStart | null;
  /** HOUSEHOLD-ADMIN-003; null = default (Monday to Friday). */
  readonly workdays: readonly Weekday[] | null;
  /** Defaults for new Tenners (HOUSEHOLD-ADMIN-003); null = built-in defaults. */
  readonly defaults: NewTennerDefaults | null;
  /** Household vacation (SCHEDULING-005), or null. */
  readonly vacation: Vacation | null;
  /** Household members (HOUSEHOLD-ADMIN-001); null = never saved, the seed members apply. */
  readonly members: readonly HouseholdMember[] | null;
  /** Optimistic-lock version of `members` (0 = never saved). */
  readonly membersVersion: number;
  /** Household categories (HOUSEHOLD-ADMIN-002); null = never saved, the seed categories apply. */
  readonly categories: readonly HouseholdCategory[] | null;
  readonly categoriesVersion: number;
  /** Running handovers (HOUSEHOLD-004), at most one per member; expired ones are removed lazily. */
  readonly handovers: readonly Handover[];
  readonly handoversVersion: number;
  readonly updatedAt: string;
  readonly updatedBy: UserId | null;
}

/** Household-wide defaults for new Tenners (HOUSEHOLD-ADMIN-003). The default assignee stays a personal setting. */
export interface NewTennerDefaults {
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
}

export const DEFAULT_HOUSEHOLD_NAME = "Unser Haushalt";
export const DEFAULT_WEEK_START: WeekStart = "MONDAY";
export const DEFAULT_WORKDAYS: readonly Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];
export const DEFAULT_TENNER_DEFAULTS: NewTennerDefaults = { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14 };

/** Changeable household settings (PUT /household). */
export type HouseholdSettingsChange = {
  readonly [K in "name" | "timezone" | "weekStartsOn" | "workdays" | "defaults"]?: HouseholdSettings[K] | undefined;
};
