/**
 * „Was gibt es heute?“ (FOOD-017): today's and tomorrow's meals from GET /meals/today (household time). Pure answer
 * builders plus the API call; the handler lives in handlers/meals.ts, the briefing uses mealSentence.
 */

import type { TennerApi } from "./tennerApi.js";

export type MealSlot = "LUNCH" | "DINNER";

export interface SpokenDish {
  readonly name: string;
  readonly isVegetarian: boolean;
  readonly vegetarianVariant?: string;
}

export interface MealDay {
  readonly date: string;
  readonly meals: readonly { readonly slot: MealSlot; readonly status?: string; readonly dish: SpokenDish | null }[];
}

export interface MealDays {
  readonly today: string;
  readonly days: readonly MealDay[];
}

export const fetchMealDays = (api: TennerApi): Promise<MealDays> => api.request<MealDays>("GET", "/meals/today?days=2");

const SLOT_WORD: Readonly<Record<MealSlot, string>> = { LUNCH: "mittags", DINNER: "abends" };
const SLOT_NOUN: Readonly<Record<MealSlot, string>> = { LUNCH: "Mittag", DINNER: "Abend" };

/** „Burger, für Vegetarier mit Veggie-Patty“ */
export const spokenDish = (dish: SpokenDish): string => (!dish.isVegetarian && dish.vegetarianVariant ? `${dish.name}, für Vegetarier ${dish.vegetarianVariant}` : dish.name);

const plannedDish = (day: MealDay | undefined, slot: MealSlot): SpokenDish | undefined => {
  const meal = day?.meals.find((entry) => entry.slot === slot);
  return meal && meal.status !== "SKIPPED" && meal.dish ? meal.dish : undefined;
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** dayWord: „heute“ or „morgen“; slot: only that meal. */
export function mealAnswer(day: MealDay | undefined, dayWord: "heute" | "morgen", slot?: MealSlot): string {
  if (slot) {
    const dish = plannedDish(day, slot);
    return dish ? `${capitalize(dayWord)} ${SLOT_NOUN[slot]} gibt es ${spokenDish(dish)}.` : `Für ${dayWord} ${SLOT_NOUN[slot]} ist noch nichts geplant.`;
  }
  const lunch = plannedDish(day, "LUNCH");
  const dinner = plannedDish(day, "DINNER");
  if (!lunch && !dinner) return `Für ${dayWord} ist noch nichts geplant.`;
  const parts = [...(lunch ? [`${SLOT_WORD.LUNCH} ${spokenDish(lunch)}`] : []), ...(dinner ? [`${SLOT_WORD.DINNER} ${spokenDish(dinner)}`] : [])];
  const missing = !lunch ? " Mittags ist nichts geplant." : !dinner ? " Abends ist nichts geplant." : "";
  return `${capitalize(dayWord)} gibt es ${parts.join(" und ")}.${missing}`;
}

/** Briefing sentence (ALEXA-005 + FOOD-017); undefined when nothing is planned today. */
export function mealSentence(days: MealDays): string | undefined {
  const today = days.days.find((day) => day.date === days.today);
  if (!plannedDish(today, "LUNCH") && !plannedDish(today, "DINNER")) return undefined;
  return mealAnswer(today, "heute").replace(/ (Mittags|Abends) ist nichts geplant\.$/, "");
}

/**
 * Day asked for: no slot or today → 0, tomorrow → 1, anything else → undefined (only two days are known). `spokenDate`
 * is the AMAZON.DATE value (YYYY-MM-DD).
 */
export function dayIndex(spokenDate: string | undefined, today: string): 0 | 1 | undefined {
  if (spokenDate === undefined || spokenDate === today) return 0;
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return spokenDate === tomorrow.toISOString().slice(0, 10) ? 1 : undefined;
}
