/** Weekly meal plans (FOOD-006): stored as PLAN#<weekStart>, returned with dish summaries and rule violations. */

import type { Weekday } from "../../models/enums.js";
import type { Violation } from "../planner/rules.js";
import type { DishResponse, Lightness, MealSlot, Temperature } from "./dish.js";
import type { NutritionEstimate } from "../nutrition.js";

export const SLOT_SOURCES = ["AUTO", "MANUAL"] as const;
export type SlotSource = (typeof SLOT_SOURCES)[number];

/** PLANNED until the family marks it (FOOD-023). */
export const SLOT_STATUSES = ["PLANNED", "COOKED", "SKIPPED", "OTHER"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export interface StoredPlanSlot {
  readonly slotId: string;
  readonly dishId: string | null;
  /** Regenerating the week keeps locked meals (FOOD-008, FOOD-022). */
  readonly locked: boolean;
  readonly source: SlotSource;
  readonly status: SlotStatus;
  readonly emptyReason?: string;
}

export interface StoredPlan {
  readonly weekStart: string;
  readonly seed: number;
  readonly generatedAt: string;
  readonly slots: readonly StoredPlanSlot[];
}

/** What the plan page and Alexa need of a dish. */
export interface DishSummary {
  readonly dishId: string;
  readonly name: string;
  readonly category: DishResponse["category"];
  readonly lightness: Lightness;
  readonly temperature: Temperature;
  readonly activeMinutes: number;
  readonly totalMinutes: number;
  readonly isVegetarian: boolean;
  readonly vegetarianVariant?: string;
  readonly imageKey?: string;
  /** Per adult portion (FOOD-012). */
  readonly nutrition: NutritionEstimate;
  readonly favorite: boolean;
  readonly archived: boolean;
}

export interface PlanSlotResponse extends StoredPlanSlot {
  readonly date: string;
  readonly weekday: Weekday;
  readonly slot: MealSlot;
  /** null for an empty meal or a dish that no longer exists. */
  readonly dish: DishSummary | null;
}

export interface MealPlanResponse {
  readonly weekStart: string;
  readonly weekEnd: string;
  /** False while the household has no dishes or no eaters: then nothing is planned or stored yet. */
  readonly ready: boolean;
  readonly setup: { readonly hasDishes: boolean; readonly hasEaters: boolean };
  readonly generatedAt: string | null;
  readonly slots: readonly PlanSlotResponse[];
  /** Current rule violations of the plan (also soft ones), e.g. after a manual choice. */
  readonly violations: readonly Violation[];
}

export function toDishSummary(dish: DishResponse): DishSummary {
  return {
    dishId: dish.dishId,
    name: dish.name,
    category: dish.category,
    lightness: dish.lightness,
    temperature: dish.temperature,
    activeMinutes: dish.activeMinutes,
    totalMinutes: dish.totalMinutes,
    isVegetarian: dish.isVegetarian,
    ...(dish.vegetarianVariant === undefined ? {} : { vegetarianVariant: dish.vegetarianVariant }),
    ...(dish.imageKey === undefined ? {} : { imageKey: dish.imageKey }),
    nutrition: dish.nutrition,
    favorite: dish.favorite,
    archived: dish.archived,
  };
}
