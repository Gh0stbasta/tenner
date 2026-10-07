/** Weeks and meal slots (FOOD-006): a week is seven days from the household's week start; two meals per day. */

import type { WeekStart } from "../../models/enums.js";
import { addDays } from "../../utils/clock.js";
import { weekdayOf } from "../../utils/schedule.js";
import { MEAL_SLOTS, type MealSlot } from "../models/dish.js";
import type { PlannedMeal } from "./rules.js";

export const DAYS_PER_WEEK = 7;

/** The first day of the week containing `date`. */
export function weekStartOf(date: string, weekStartsOn: WeekStart): string {
  const weekday = weekdayOf(date);
  const offset = weekStartsOn === "MONDAY" ? ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].indexOf(weekday) : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].indexOf(weekday);
  return addDays(date, -offset);
}

export const slotIdOf = (date: string, slot: MealSlot): string => `${date}#${slot}`;

export function parseSlotId(slotId: string): { date: string; slot: MealSlot } | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})#(LUNCH|DINNER)$/.exec(slotId);
  return match ? { date: match[1] as string, slot: match[2] as MealSlot } : undefined;
}

/** The 14 meals of a week, in order, without dishes. */
export function emptyWeek(weekStart: string): PlannedMeal[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, day) => addDays(weekStart, day)).flatMap((date) =>
    MEAL_SLOTS.map((slot) => ({ slotId: slotIdOf(date, slot), date, weekday: weekdayOf(date), slot, dish: null })),
  );
}
