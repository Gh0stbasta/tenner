/** Typed enumerations of the Tenner domain. Single source of truth for allowed values. */

export const CATEGORIES = ["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Household member ID (HOUSEHOLD-ADMIN-001): stable, immutable uppercase slug such as "STEFAN".
 * Members are managed data (tenner-households); this only fixes the format.
 */
export type UserId = string;
export const USER_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;

/** Fixed member color palette (HOUSEHOLD-ADMIN-001). */
export const MEMBER_COLORS = ["BLUE", "GREEN", "ORANGE", "PURPLE", "RED", "TEAL", "PINK", "GREY"] as const;
export type MemberColor = (typeof MEMBER_COLORS)[number];

/** Frequency units (SCHEDULING-001). DAY/WEEK map to exact days; MONTH/YEAR use calendar arithmetic. */
export const FREQUENCY_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

/** Weekdays for weekday-bound weekly frequencies (SCHEDULING-002), Monday first (ISO order). */
export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
