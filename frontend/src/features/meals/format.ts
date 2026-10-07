/** Display helpers of the meal plan (FOOD-009). */

import { formatMinutes } from "../../utils/format";
import type { PlanSlot, Violation } from "./api";

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
