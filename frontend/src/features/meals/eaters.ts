/** Summaries of eaters for the family food profile (FOOD-004). */

import type { Eater } from "./api";
import { PROTEIN_LABELS, tagList } from "./labels";

const formatPortion = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export function describeEater(eater: Eater): string {
  const parts: string[] = [eater.type === "ADULT" ? "Erwachsen" : "Kind"];
  if (eater.portionFactor !== (eater.type === "ADULT" ? 1 : 0.5))
    parts.push(`Portion ${formatPortion(eater.portionFactor)}`);
  if (eater.diet === "VEGETARIAN") {
    const exceptions = eater.vegetarianExceptions.map((tag) => PROTEIN_LABELS[tag]).join(", ");
    parts.push(exceptions ? `vegetarisch (isst ${exceptions})` : "vegetarisch");
  }
  if (eater.allergies.length > 0) parts.push(`⚠ Allergie: ${tagList(eater.allergies)}`);
  if (eater.dislikeTags.length + eater.dislikeIngredients.length > 0)
    parts.push(`mag ${eater.dislikeTags.length + eater.dislikeIngredients.length} Dinge nicht`);
  return parts.join(" · ");
}
