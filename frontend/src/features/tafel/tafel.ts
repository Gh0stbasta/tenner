/** „Tafel“ (MAINT-022): pure helpers for the full-screen overview on the Echo Show browser. */

import type { MealPlan, PlanSlot, ShoppingItem } from "../meals/api";

/** Refresh interval of the page (plan, Aufgaben, shopping list). */
export const TAFEL_REFRESH_MS = 5 * 60_000;
/** Shopping items shown before „+ n weitere“. */
export const TAFEL_SHOPPING_LIMIT = 15;
/** localStorage key of the „Heute“ / „Woche“ switch. */
export const TAFEL_VIEW_KEY = "tenner.tafel.view";

export type TafelView = "DAY" | "WEEK";

/** The remembered view; „Heute“ when nothing (or something unreadable) is stored. */
export function readTafelView(storage: Pick<Storage, "getItem"> | undefined): TafelView {
  try {
    return storage?.getItem(TAFEL_VIEW_KEY) === "WEEK" ? "WEEK" : "DAY";
  } catch {
    return "DAY";
  }
}

export function writeTafelView(storage: Pick<Storage, "setItem"> | undefined, view: TafelView): void {
  try {
    storage?.setItem(TAFEL_VIEW_KEY, view);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

export interface TafelDay {
  readonly date: string;
  readonly lunch: PlanSlot | undefined;
  readonly dinner: PlanSlot | undefined;
}

/** The plan's days in plan order (Monday – Sunday for a Monday week), lunch and dinner each. */
export function daysOf(plan: MealPlan | undefined): TafelDay[] {
  if (!plan?.ready) return [];
  const dates = [...new Set(plan.slots.map((slot) => slot.date))];
  return dates.map((date) => ({
    date,
    lunch: plan.slots.find((slot) => slot.date === date && slot.slot === "LUNCH"),
    dinner: plan.slots.find((slot) => slot.date === date && slot.slot === "DINNER"),
  }));
}

/** Open shopping items in the list's order, limited for the screen. */
export function openShopping(items: readonly ShoppingItem[] | undefined, limit = TAFEL_SHOPPING_LIMIT) {
  const open = (items ?? []).filter((item) => !item.checked);
  return { shown: open.slice(0, limit), more: Math.max(0, open.length - limit) };
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", timeZone: "UTC" });

/** „Dienstag, 17. November“. */
export const headerDate = (now: Date): string => DATE_FORMAT.format(now);
/** „14:05“. */
export const headerTime = (now: Date): string => TIME_FORMAT.format(now);
/** „Di., 17.“ for a plan date (YYYY-MM-DD). */
export const dayLabel = (date: string): string => WEEKDAY_FORMAT.format(new Date(`${date}T12:00:00Z`));
