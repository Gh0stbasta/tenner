/**
 * Family food profile (FOOD-004): who eats, what each person may and may not eat, and the household's planning rules.
 * Defaults reproduce the owner's rules (EPIC-FOOD-001), so a new household only enters its eaters. Allergies are
 * health data: never logged, never in notification texts.
 */

import { WEEKDAYS, type Weekday } from "../../models/enums.js";
import type { MealSlot } from "./dish.js";
import type { IngredientTag, ProteinTag } from "./ingredient.js";

export const EATER_TYPES = ["ADULT", "CHILD"] as const;
export type EaterType = (typeof EATER_TYPES)[number];

export const DIETS = ["OMNIVORE", "VEGETARIAN"] as const;
export type Diet = (typeof DIETS)[number];

/** Weekday and meal, e.g. MON#DINNER (chicken rule R5). */
export type WeekSlot = `${Weekday}#${MealSlot}`;

export const WEEK_SLOTS: readonly WeekSlot[] = WEEKDAYS.flatMap((day) => [`${day}#LUNCH` as const, `${day}#DINNER` as const]);

export interface Eater {
  readonly eaterId: string;
  /** Display name, shown only in the app. */
  readonly name: string;
  readonly type: EaterType;
  /** Optional link to a Tenner household member. */
  readonly memberId?: string;
  /** Share of an adult portion (shopping list and cost). */
  readonly portionFactor: number;
  readonly diet: Diet;
  /** Protein forms a vegetarian eats anyway (e.g. MINCE, SAUSAGE). */
  readonly vegetarianExceptions: readonly ProteinTag[];
  /** Hard: dishes with these tags are never planned while the eater eats (R1). */
  readonly allergies: readonly IngredientTag[];
  /** Hard (R3). */
  readonly dislikeTags: readonly IngredientTag[];
  readonly dislikeIngredients: readonly string[];
  /** Soft weighting for the planner. */
  readonly likeIngredients: readonly string[];
  readonly likeGroups: readonly string[];
}

/** Who eats which meals; null = default (weekday lunch: all adults, everything else: all eaters). */
export interface Attendance {
  readonly weekdayLunch: readonly string[] | null;
  readonly weekendLunch: readonly string[] | null;
  readonly dinner: readonly string[] | null;
}

export interface HouseholdFoodRules {
  readonly dislikeTags: readonly IngredientTag[];
  readonly dislikeIngredients: readonly string[];
  /** R4: active cooking time (decision 1). */
  readonly maxActiveMinutes: number;
  readonly attendance: Attendance;
  /** R9. */
  readonly lightLunchOnWeekdays: boolean;
  /** R11. */
  readonly maxSaladLunchesPerWeek: number;
  /** R5. */
  readonly chicken: { readonly maxPerWeek: number; readonly allowedSlots: readonly WeekSlot[] };
  /** R6. */
  readonly maxBurgerPerWeek: number;
  /** R7: each at most once per week (decision 3, beef and pork by form). */
  readonly limitedProteinTags: readonly ProteinTag[];
  /** Local times "HH:MM" for the calendar (FOOD-015) and notifications (FOOD-016). */
  readonly mealTimes: { readonly lunch: string; readonly dinner: string };
}

export interface FoodProfile {
  readonly eaters: readonly Eater[];
  readonly household: HouseholdFoodRules;
  /** Null until the profile was saved once. */
  readonly updatedAt: string | null;
}

export const DEFAULT_HOUSEHOLD_FOOD_RULES: HouseholdFoodRules = {
  dislikeTags: ["TOFU", "QUINOA", "BLUE_CHEESE"],
  dislikeIngredients: [],
  maxActiveMinutes: 20,
  attendance: { weekdayLunch: null, weekendLunch: null, dinner: null },
  lightLunchOnWeekdays: true,
  maxSaladLunchesPerWeek: 2,
  chicken: { maxPerWeek: 1, allowedSlots: ["MON#DINNER", "TUE#DINNER"] },
  maxBurgerPerWeek: 1,
  limitedProteinTags: ["POULTRY", "FISH", "MINCE", "BURGER_PATTY", "SAUSAGE", "MEATBALL", "HAM"],
  mealTimes: { lunch: "12:00", dinner: "18:00" },
};

export const DEFAULT_PORTION_FACTOR: Readonly<Record<EaterType, number>> = { ADULT: 1, CHILD: 0.5 };

export const EMPTY_FOOD_PROFILE: FoodProfile = { eaters: [], household: DEFAULT_HOUSEHOLD_FOOD_RULES, updatedAt: null };

const WEEKEND: ReadonlySet<Weekday> = new Set(["SAT", "SUN"]);

/** The eaters of a meal (rules R1 – R3 and portions apply to them only, EPIC-FOOD-001 decision 5). */
export function eatersAt(profile: Pick<FoodProfile, "eaters" | "household">, weekday: Weekday, slot: MealSlot): Eater[] {
  const { attendance } = profile.household;
  const configured = slot === "DINNER" ? attendance.dinner : WEEKEND.has(weekday) ? attendance.weekendLunch : attendance.weekdayLunch;
  if (configured !== null) return profile.eaters.filter((eater) => configured.includes(eater.eaterId));
  if (slot === "LUNCH" && !WEEKEND.has(weekday)) return profile.eaters.filter((eater) => eater.type === "ADULT");
  return [...profile.eaters];
}
