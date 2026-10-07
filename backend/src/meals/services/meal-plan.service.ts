/**
 * Weekly meal plans (FOOD-006). A plan for the current or next week is created on first read (conditional write,
 * so parallel reads create one plan) and by the notifier ahead of time. Nothing is planned or stored while the
 * household has no dishes or no eaters: a plan made without the allergies would be wrong.
 */

import { randomInt } from "node:crypto";
import { ApplicationError, ConflictError, NotFoundError } from "../../exceptions/index.js";
import type { WeekStart } from "../../models/enums.js";
import { addDays, toUtcTimestamp, type Clock } from "../../utils/clock.js";
import { dateInTimeZone } from "../../utils/timezone.js";
import { itemKey } from "../keys.js";
import type { DishResponse } from "../models/dish.js";
import { toDishSummary, type MealPlanResponse, type PlanSlotResponse, type StoredPlan, type StoredPlanSlot } from "../models/plan.js";
import type { FoodProfile } from "../models/profile.js";
import { plan } from "../planner/planner.js";
import { checkWeek, type PlannedMeal } from "../planner/rules.js";
import { DAYS_PER_WEEK, emptyWeek, weekStartOf } from "../planner/week.js";
import type { MealItem, MealsStore } from "../repositories/meals-store.js";

/** Plans are kept about a year (FOOD-023 history), then removed by the table's TTL. */
const PLAN_RETENTION_DAYS = 400;

export interface MealPlanServiceDependencies {
  readonly store: MealsStore;
  /** All dishes with derived values, also archived ones (old plans keep their references). */
  readonly dishesOf: (tenantId: string) => Promise<readonly DishResponse[]>;
  readonly profileOf: (tenantId: string) => Promise<FoodProfile>;
  readonly settingsOf: (tenantId: string) => Promise<{ readonly timezone: string; readonly weekStartsOn: WeekStart }>;
  readonly clock: Clock;
  /** Seed source; random by default. */
  readonly seed?: () => number;
}

/** "current", "next" or a week start date. */
export type WeekReference = "current" | "next" | string;

export interface PlanWeek {
  readonly tenantId: string;
  readonly weekStart: string;
  readonly currentWeekStart: string;
  readonly today: string;
}

interface PlanData {
  readonly dishes: readonly DishResponse[];
  readonly byId: ReadonlyMap<string, DishResponse>;
  readonly profile: FoodProfile;
}

export class MealPlanService {
  constructor(private readonly deps: MealPlanServiceDependencies) {}

  /** Resolve the week reference; plans exist for the past (if stored), the current and the next week. */
  async resolveWeek(tenantId: string, week: WeekReference): Promise<PlanWeek> {
    const settings = await this.deps.settingsOf(tenantId);
    const today = dateInTimeZone(this.deps.clock(), settings.timezone);
    const currentWeekStart = weekStartOf(today, settings.weekStartsOn);
    const weekStart = week === "current" ? currentWeekStart : week === "next" ? addDays(currentWeekStart, DAYS_PER_WEEK) : week;
    if (weekStartOf(weekStart, settings.weekStartsOn) !== weekStart) {
      throw new ApplicationError("VALIDATION_ERROR", 400, "Not the first day of a week.", [{ field: "weekStart", message: "Must be the first day of a week." }]);
    }
    if (weekStart > addDays(currentWeekStart, DAYS_PER_WEEK)) throw new ApplicationError("WEEK_OUT_OF_RANGE", 400, "Plans exist up to next week.");
    return { tenantId, weekStart, currentWeekStart, today };
  }

  async getPlan(tenantId: string, week: WeekReference): Promise<MealPlanResponse> {
    const resolved = await this.resolveWeek(tenantId, week);
    const data = await this.load(tenantId);
    const stored = await this.storedPlan(tenantId, resolved.weekStart);
    if (stored) return this.toResponse(resolved.weekStart, stored.plan, data);
    if (resolved.weekStart < resolved.currentWeekStart) throw new NotFoundError("No meal plan for this week.");
    if (!isReady(data)) return this.toResponse(resolved.weekStart, null, data);
    const created = await this.create(resolved, data);
    return this.toResponse(resolved.weekStart, created, data);
  }

  /** Notifier: make sure the current and the next week have a plan (idempotent, cheap when they exist). */
  async ensurePlans(tenantId: string): Promise<number> {
    let created = 0;
    for (const week of ["current", "next"] as const) {
      const resolved = await this.resolveWeek(tenantId, week);
      if (await this.storedPlan(tenantId, resolved.weekStart)) continue;
      const data = await this.load(tenantId);
      if (!isReady(data)) return created;
      await this.create(resolved, data);
      created += 1;
    }
    return created;
  }

  /** Stored plan with its version, or undefined. */
  async storedPlan(tenantId: string, weekStart: string): Promise<{ plan: StoredPlan; version: number } | undefined> {
    const item = await this.deps.store.get(tenantId, itemKey("PLAN", weekStart));
    return item ? { plan: toStoredPlan(item), version: item.version } : undefined;
  }

  async load(tenantId: string): Promise<PlanData> {
    const [dishes, profile] = await Promise.all([this.deps.dishesOf(tenantId), this.deps.profileOf(tenantId)]);
    return { dishes, byId: new Map(dishes.map((dish) => [dish.dishId, dish])), profile };
  }

  /** Dishes of the previous week (rule R12, soft). */
  async recentDishIds(tenantId: string, weekStart: string): Promise<Set<string>> {
    const previous = await this.storedPlan(tenantId, addDays(weekStart, -DAYS_PER_WEEK));
    return new Set(previous?.plan.slots.flatMap((slot) => (slot.dishId ? [slot.dishId] : [])) ?? []);
  }

  newSeed(): number {
    return this.deps.seed ? this.deps.seed() : randomInt(1, 2 ** 31 - 1);
  }

  expiresAt(weekStart: string): number {
    return Math.floor(Date.parse(`${addDays(weekStart, PLAN_RETENTION_DAYS)}T00:00:00Z`) / 1000);
  }

  private async create(week: PlanWeek, data: PlanData): Promise<StoredPlan> {
    const seed = this.newSeed();
    const result = plan({
      weekStart: week.weekStart,
      dishes: data.dishes.filter((dish) => !dish.archived),
      profile: data.profile,
      context: { recentDishIds: await this.recentDishIds(week.tenantId, week.weekStart) },
      seed,
    });
    const created: StoredPlan = {
      weekStart: week.weekStart,
      seed,
      generatedAt: toUtcTimestamp(this.deps.clock()),
      slots: result.slots.map((slot) => ({ ...slot, locked: false, source: "AUTO", status: "PLANNED" })),
    };
    try {
      await this.deps.store.put(week.tenantId, itemKey("PLAN", week.weekStart), { ...created, expiresAt: this.expiresAt(week.weekStart) });
      return created;
    } catch (error) {
      // Someone else created the plan at the same moment: use theirs.
      if (error instanceof ConflictError) {
        const existing = await this.storedPlan(week.tenantId, week.weekStart);
        if (existing) return existing.plan;
      }
      throw error;
    }
  }

  /** Plan response with dish summaries and the current rule violations. */
  toResponse(weekStart: string, stored: StoredPlan | null, data: PlanData): MealPlanResponse {
    const stateOf = new Map(stored?.slots.map((slot) => [slot.slotId, slot]) ?? []);
    const meals: PlannedMeal[] = emptyWeek(weekStart).map((meal) => {
      const dishId = stateOf.get(meal.slotId)?.dishId;
      return { ...meal, dish: dishId ? (data.byId.get(dishId) ?? null) : null };
    });
    const setup = { hasDishes: data.dishes.some((dish) => !dish.archived), hasEaters: data.profile.eaters.length > 0 };
    const slots: PlanSlotResponse[] = meals.map((meal) => {
      const state: StoredPlanSlot = stateOf.get(meal.slotId) ?? { slotId: meal.slotId, dishId: null, locked: false, source: "AUTO", status: "PLANNED" };
      return { ...state, date: meal.date, weekday: meal.weekday, slot: meal.slot, dish: meal.dish ? toDishSummary(meal.dish) : null };
    });
    return {
      weekStart,
      weekEnd: addDays(weekStart, DAYS_PER_WEEK - 1),
      ready: stored !== null,
      setup,
      generatedAt: stored?.generatedAt ?? null,
      slots,
      violations: stored ? checkWeek(meals, data.profile) : [],
    };
  }
}

const isReady = (data: PlanData): boolean => data.dishes.some((dish) => !dish.archived) && data.profile.eaters.length > 0;

/** Stored plan; the store holds only values written by this service. */
export function toStoredPlan(item: MealItem): StoredPlan {
  const data = item.data as unknown as StoredPlan;
  return { weekStart: data.weekStart, seed: data.seed, generatedAt: data.generatedAt, slots: data.slots };
}
