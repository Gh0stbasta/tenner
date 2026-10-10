/**
 * „Essensplan am Morgen“ (FOOD-016): at the member's meal time, today's lunch and dinner — with the vegetarian
 * variant when the member eats vegetarian — and a hint when the shopping list still has open items. Days without a
 * planned meal are skipped; quiet hours are respected; one message per member, channel and day (delivery key).
 * No allergies or other health data in the text.
 */

import type { NotificationPreferences, UserId } from "../models/index.js";
import { timezoneFor, withLog } from "./daily-digest.js";
import type { NotificationMessage, Recipient } from "./model.js";
import type { NotificationJob } from "./notifier.js";
import { inQuietHours, isDueAt, localTime } from "./schedule.js";

export interface TodayMeal {
  readonly slot: "LUNCH" | "DINNER";
  readonly status?: string;
  readonly dish: { readonly name: string; readonly isVegetarian: boolean; readonly vegetarianVariant?: string | undefined } | null;
}

export interface MealTodayDependencies {
  readonly preferencesOf: (tenantId: string, userId: UserId) => Promise<NotificationPreferences>;
  /** The planned meals of a local date. */
  readonly mealsOn: (tenantId: string, date: string) => Promise<readonly TodayMeal[]>;
  /** Whether the member eats vegetarian (their eater in the food profile); false when not linked. */
  readonly isVegetarian: (tenantId: string, userId: UserId) => Promise<boolean>;
  /** Unchecked items of this week's shopping list; undefined when unknown. */
  readonly openShoppingItems: (tenantId: string) => Promise<number | undefined>;
  readonly appUrl: string | undefined;
}

const LABELS = { LUNCH: "Mittag", DINNER: "Abend" } as const;

function dishText(meal: TodayMeal, vegetarian: boolean): string {
  const dish = meal.dish;
  if (!dish) return "";
  return vegetarian && !dish.isVegetarian && dish.vegetarianVariant ? `${dish.name} (für dich: ${dish.vegetarianVariant})` : dish.name;
}

export function renderMealToday(meals: readonly TodayMeal[], recipient: Recipient, vegetarian: boolean, openItems: number | undefined, appUrl: string | undefined): NotificationMessage | undefined {
  const planned = meals
    .filter((meal) => meal.dish !== null && meal.status !== "SKIPPED")
    .sort((a, b) => (a.slot === b.slot ? 0 : a.slot === "LUNCH" ? -1 : 1));
  if (planned.length === 0) return undefined;
  const parts = planned.map((meal) => `${LABELS[meal.slot]} ${dishText(meal, vegetarian)}`);
  const lines = [`Heute: ${parts.join(" · ")}`];
  if (openItems !== undefined && openItems > 0) lines.push(`Einkaufsliste: ${openItems} ${openItems === 1 ? "Ding" : "Dinge"} offen`);
  const deepLink = appUrl === undefined ? undefined : `${appUrl.replace(/\/+$/, "")}/essen`;
  const lunch = planned.find((meal) => meal.slot === "LUNCH");
  const dinner = planned.find((meal) => meal.slot === "DINNER");
  return {
    type: "MEAL_TODAY",
    userId: recipient.userId,
    subject: `🍽️ Heute: ${parts.join(" · ")}`,
    textBody: lines.join("\n"),
    ...(deepLink === undefined ? {} : { deepLink }),
    facts: { ...(lunch ? { lunch: dishText(lunch, vegetarian) } : {}), ...(dinner ? { dinner: dishText(dinner, vegetarian) } : {}) },
  };
}

export function mealTodayJob(deps: MealTodayDependencies): NotificationJob {
  return {
    type: "MEAL_TODAY",
    async channelsDue(recipient, now) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const timezone = timezoneFor(preferences, recipient);
      if (!preferences.mealToday.enabled || !isDueAt(preferences.mealToday.time, now, timezone)) return [];
      if (inQuietHours(preferences.quietHours, now, timezone)) return [];
      return withLog(preferences.mealToday.channels);
    },
    async render(recipient, now) {
      const preferences = await deps.preferencesOf(recipient.tenantId, recipient.userId);
      const { date } = localTime(now, timezoneFor(preferences, recipient));
      const meals = await deps.mealsOn(recipient.tenantId, date);
      if (!meals.some((meal) => meal.dish !== null && meal.status !== "SKIPPED")) return undefined;
      const [vegetarian, openItems] = await Promise.all([deps.isVegetarian(recipient.tenantId, recipient.userId), deps.openShoppingItems(recipient.tenantId)]);
      return renderMealToday(meals, recipient, vegetarian, openItems, deps.appUrl);
    },
  };
}
