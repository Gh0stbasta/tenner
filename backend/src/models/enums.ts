/** Typed enumerations of the Tenner domain. Single source of truth for allowed values. */

/**
 * Category ID (HOUSEHOLD-ADMIN-002): immutable uppercase slug such as "HOUSEHOLD". Categories are managed data
 * (tenner-households); the six original ones are the seed (SEED_CATEGORIES).
 */
export type Category = string;
export const CATEGORY_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;

/** Fixed category icon set (HOUSEHOLD-ADMIN-002); the frontend maps each to an icon. */
export const CATEGORY_ICONS = ["HOME", "CLEANING", "FITNESS", "FAMILY", "PERSON", "MONEY", "GARDEN", "PET", "CAR", "HEALTH", "WORK", "STAR"] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

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
