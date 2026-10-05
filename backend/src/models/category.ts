import type { CategoryIcon, MemberColor } from "./enums.js";
import { SEED_TIMESTAMP } from "./user.js";

/** A household category (HOUSEHOLD-ADMIN-002), stored in the household item of tenner-households. */
export interface HouseholdCategory {
  readonly categoryId: string;
  readonly name: string;
  readonly icon: CategoryIcon;
  /** Same fixed palette as member colors. */
  readonly color: MemberColor;
  readonly sortOrder: number;
  /** Archived categories stay valid on existing Tenners but cannot be chosen for new ones. */
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const seed = (categoryId: string, name: string, icon: CategoryIcon, color: MemberColor, sortOrder: number): HouseholdCategory => ({
  categoryId,
  name,
  icon,
  color,
  sortOrder,
  archived: false,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
});

/** The categories that existed before HOUSEHOLD-ADMIN-002; read-time default until a household saves its own list. */
export const SEED_CATEGORIES: readonly HouseholdCategory[] = [
  seed("HOUSEHOLD", "Haushalt", "CLEANING", "BLUE", 0),
  seed("FITNESS", "Fitness", "FITNESS", "GREEN", 1),
  seed("FAMILY", "Familie", "FAMILY", "PINK", 2),
  seed("HOME", "Haus & Garten", "HOME", "ORANGE", 3),
  seed("PERSONAL", "Persönlich", "PERSON", "PURPLE", 4),
  seed("FINANCE", "Finanzen", "MONEY", "TEAL", 5),
];
