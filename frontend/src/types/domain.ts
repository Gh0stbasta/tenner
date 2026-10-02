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
