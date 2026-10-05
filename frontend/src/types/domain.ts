/**
 * Domain enumerations and display labels. Values mirror backend/src/models/enums.ts.
 * Users are hardcoded until HOUSEHOLD-ADMIN-001 (TD-007).
 */

export const CATEGORIES = ["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"] as const;
export type Category = (typeof CATEGORIES)[number];

export const USER_IDS = ["STEFAN", "JULIA"] as const;
export type UserId = (typeof USER_IDS)[number];

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  HOUSEHOLD: "Haushalt",
  FITNESS: "Fitness",
  FAMILY: "Familie",
  HOME: "Haus & Garten",
  PERSONAL: "Persönlich",
  FINANCE: "Finanzen",
};

export const USER_LABELS: Readonly<Record<UserId, string>> = {
  STEFAN: "Stefan",
  JULIA: "Julia",
};

/** Frequency units (SCHEDULING-001). Mirrors backend/src/models/enums.ts. */
export const FREQUENCY_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

/** Unit labels ("Alle 3 Monate"). */
export const FREQUENCY_UNIT_LABELS: Readonly<Record<FrequencyUnit, string>> = {
  DAY: "Tage",
  WEEK: "Wochen",
  MONTH: "Monate",
  YEAR: "Jahre",
};

/** Approximate days per unit, mirroring the backend (frequencyDays for MONTH/YEAR is an approximation). */
export const APPROXIMATE_DAYS_PER_UNIT: Readonly<Record<FrequencyUnit, number>> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};
