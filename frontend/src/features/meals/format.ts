/** Display helpers of the meal plan (FOOD-009). */

import { formatMinutes } from "../../utils/format";
import type { HouseholdFoodRules, NutritionEstimate, PlanSlot, Violation } from "./api";

/** Today in the device's local time (the household's timezone in practice). */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function dishDetails(slot: PlanSlot): string {
  const dish = slot.dish;
  if (!dish) return "";
  const parts = [`${formatMinutes(dish.activeMinutes)} aktiv`];
  if (dish.isVegetarian) parts.push("vegetarisch");
  else if (dish.vegetarianVariant) parts.push(`vegetarisch: ${dish.vegetarianVariant}`);
  return parts.join(" · ");
}

/** Allergy (R1) and vegetarian (R2) conflicts can harm someone: shown in red, chosen only after a confirmation. */
export const isHarmful = (violation: Violation): boolean => violation.rule === "R1" || violation.rule === "R2";

/** Meals that „Woche neu planen“ keeps (FOOD-008; same rule as the backend's `isKept`). */
export const isKept = (slot: PlanSlot, today: string): boolean =>
  slot.locked || slot.source === "MANUAL" || slot.status === "COOKED" || slot.date < today;

/** „ca. 520 kcal · 24 g Eiweiß · 60 g KH · 18 g Fett“ (FOOD-012); „mind.“ when ingredient values are missing. */
export function nutritionLine(
  nutrition: Pick<NutritionEstimate, "kcal" | "protein" | "carbs" | "fat"> & { readonly complete?: boolean },
): string {
  const prefix = nutrition.complete === false ? "mind." : "ca.";
  return `${prefix} ${nutrition.kcal} kcal · ${nutrition.protein} g Eiweiß · ${nutrition.carbs} g KH · ${nutrition.fat} g Fett`;
}

export const NUTRITION_DISCLAIMER = "Grobe Schätzung pro Erwachsenenportion, keine Ernährungsberatung.";

/** Lunch + dinner of a day per adult portion; null when no planned dish has an estimate. */
export function dayNutrition(slots: readonly PlanSlot[]): { kcal: number; complete: boolean } | null {
  const estimates = slots.flatMap((slot) => (slot.dish?.nutrition ? [slot.dish.nutrition] : []));
  if (estimates.length === 0) return null;
  return {
    kcal: Math.round(estimates.reduce((sum, estimate) => sum + estimate.kcal, 0) / 10) * 10,
    complete:
      estimates.length === slots.filter((slot) => slot.dish).length && estimates.every((estimate) => estimate.complete),
  };
}

const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI"]);

/** Soft hint for a weekday lunch above the household's threshold (FOOD-012, supports R9). */
export function heavyLunchHint(
  slot: PlanSlot,
  rules: Pick<HouseholdFoodRules, "lightLunchOnWeekdays" | "lightLunchMaxKcal"> | undefined,
): Violation | null {
  const kcal = slot.dish?.nutrition?.kcal;
  if (
    !rules?.lightLunchOnWeekdays ||
    slot.slot !== "LUNCH" ||
    !WEEKDAYS.has(slot.weekday) ||
    kcal === undefined ||
    kcal <= rules.lightLunchMaxKcal
  )
    return null;
  return {
    rule: "NUTRITION",
    severity: "SOFT",
    slotIds: [slot.slotId],
    message: `ca. ${kcal} kcal: für mittags unter der Woche eher schwer`,
  };
}
