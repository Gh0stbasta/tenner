/** Typed enumerations of the Tenner domain. Single source of truth for allowed values. */

export const CATEGORIES = ["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Household members. Hardcoded until HOUSEHOLD-ADMIN-001 moves them into managed data (TD-007). */
export const USER_IDS = ["STEFAN", "JULIA"] as const;
export type UserId = (typeof USER_IDS)[number];

/** Frequency units (SCHEDULING-001). DAY/WEEK map to exact days; MONTH/YEAR use calendar arithmetic. */
export const FREQUENCY_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];
