/**
 * Domain enumerations and display labels. Values mirror backend/src/models/enums.ts.
 * Household members are managed data since HOUSEHOLD-ADMIN-001 (see features/members).
 */

export const CATEGORIES = ["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Household member ID: immutable uppercase slug, e.g. "STEFAN" (HOUSEHOLD-ADMIN-001). */
export type UserId = string;
export const USER_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;

/** Member colors (HOUSEHOLD-ADMIN-001); mirrors backend MEMBER_COLORS. */
export const MEMBER_COLORS = ["BLUE", "GREEN", "ORANGE", "PURPLE", "RED", "TEAL", "PINK", "GREY"] as const;
export type MemberColor = (typeof MEMBER_COLORS)[number];

export const MEMBER_COLOR_LABELS: Readonly<Record<MemberColor, string>> = {
  BLUE: "Blau",
  GREEN: "Grün",
  ORANGE: "Orange",
  PURPLE: "Lila",
  RED: "Rot",
  TEAL: "Türkis",
  PINK: "Pink",
  GREY: "Grau",
};

/** Swatch colors (readable on light and dark backgrounds). */
export const MEMBER_COLOR_VALUES: Readonly<Record<MemberColor, string>> = {
  BLUE: "#1e6fd9",
  GREEN: "#2e8540",
  ORANGE: "#d9730d",
  PURPLE: "#7b4fc9",
  RED: "#d0352f",
  TEAL: "#13868f",
  PINK: "#c2357f",
  GREY: "#6b7280",
};

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  HOUSEHOLD: "Haushalt",
  FITNESS: "Fitness",
  FAMILY: "Familie",
  HOME: "Haus & Garten",
  PERSONAL: "Persönlich",
  FINANCE: "Finanzen",
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

/** Weekdays (SCHEDULING-002), Monday first. Mirrors backend/src/models/enums.ts. */
export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = {
  MON: "Mo",
  TUE: "Di",
  WED: "Mi",
  THU: "Do",
  FRI: "Fr",
  SAT: "Sa",
  SUN: "So",
};
