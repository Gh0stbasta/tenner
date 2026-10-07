/**
 * Weekly meal plans (FOOD-006). A plan for the current or next week is created on first read (conditional write,
 * so parallel reads create one plan) and by the notifier ahead of time. Nothing is planned or stored while the
 * household has no dishes or no eaters: a plan made without the allergies would be wrong.
 */

import { randomInt } from "node:crypto";
import type { Identity } from "../../auth/index.js";
import { ApplicationError, ConflictError, NotFoundError } from "../../exceptions/index.js";
import type { WeekStart } from "../../models/enums.js";
import { addDays, toUtcTimestamp, type Clock } from "../../utils/clock.js";
import { dateInTimeZone } from "../../utils/timezone.js";
import { itemKey } from "../keys.js";
import type { DishResponse } from "../models/dish.js";
import { toDishSummary, type DishSummary, type MealPlanResponse, type PlanSlotResponse, type StoredPlan, type StoredPlanSlot } from "../models/plan.js";
import type { FoodProfile } from "../models/profile.js";
import { plan } from "../planner/planner.js";
import { checkSlot, checkWeek, hasHardViolation, score, type PlannedMeal, type RuleId, type Violation } from "../planner/rules.js";
import { DAYS_PER_WEEK, emptyWeek, parseSlotId, weekStartOf } from "../planner/week.js";
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

export interface PlanData {
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

  /**
   * Replace one meal (FOOD-007) with the best-scoring dish that keeps every hard rule of the week, excluding the
   * current dish, its group and `excludeDishIds`; or put `dishId` back (undo). Past meals stay as they are.
   */
  async replaceMeal(identity: Identity, week: WeekReference, slotId: string, request: ReplaceMealRequest): Promise<MealPlanResponse> {
    const resolved = await this.resolveWeek(identity.tenantId, week);
    const { plan: stored, version } = await this.requirePlan(identity.tenantId, resolved.weekStart);
    const target = this.requireSlot(stored, slotId, resolved);
    const data = await this.load(identity.tenantId);
    const meals = this.mealsOf(resolved.weekStart, stored, data);
    const current = target.dishId ? data.byId.get(target.dishId) : undefined;
    let chosen: DishResponse;
    if (request.dishId !== undefined) {
      const dish = data.byId.get(request.dishId);
      if (!dish || dish.archived) throw new NotFoundError("Dish not found.");
      const hard = checkSlot(meals, slotId, dish, data.profile).filter((violation) => violation.severity === "HARD");
      if (hard.length > 0) throw new ApplicationError("RULE_VIOLATION", 409, hard.map((violation) => violation.message).join(" "));
      chosen = dish;
    } else {
      const excluded = new Set([...(request.excludeDishIds ?? []), ...(current ? [current.dishId] : [])]);
      const candidates = data.dishes.filter((dish) => !dish.archived && !excluded.has(dish.dishId) && !(current?.group && dish.group === current.group));
      const context = { recentDishIds: await this.recentDishIds(identity.tenantId, resolved.weekStart) };
      const scored = candidates
        .filter((dish) => !hasHardViolation(checkSlot(meals, slotId, dish, data.profile, context)))
        .map((dish) => ({ dish, value: score(meals.map((meal) => (meal.slotId === slotId ? { ...meal, dish } : meal)), data.profile, context) }))
        .sort((a, b) => b.value - a.value || a.dish.name.localeCompare(b.dish.name, "de"));
      const best = scored[0];
      if (!best) throw new ApplicationError("NO_ALTERNATIVE", 409, this.noAlternativeMessage(meals, slotId, candidates, data));
      chosen = best.dish;
    }
    const slots = stored.slots.map((slot): StoredPlanSlot => (slot.slotId === slotId ? { slotId, dishId: chosen.dishId, locked: false, source: "AUTO", status: "PLANNED" } : slot));
    return this.save(identity.tenantId, { ...stored, slots }, version, data);
  }

  /**
   * Plan the week again (FOOD-008) with a new seed, keeping locked, manual, cooked and past meals; or put the previous
   * dishes of the replanned meals back (`restore`, undo).
   */
  async regenerateWeek(identity: Identity, week: WeekReference, request: RegenerateWeekRequest = {}): Promise<RegeneratedPlanResponse> {
    const resolved = await this.resolveWeek(identity.tenantId, week);
    const { plan: stored, version } = await this.requirePlan(identity.tenantId, resolved.weekStart);
    const data = await this.load(identity.tenantId);
    const kept = new Set(stored.slots.filter((slot) => isKept(slot, resolved.today)).map((slot) => slot.slotId));
    const seed = request.restore ? stored.seed : this.newSeed();
    const slots = request.restore ? this.restoredSlots(stored, kept, request.restore, data) : await this.replannedSlots(resolved, stored, kept, data, seed);
    const before = new Map(stored.slots.map((slot) => [slot.slotId, slot.dishId]));
    const changed = slots.filter((slot) => before.get(slot.slotId) !== slot.dishId).length;
    const response = await this.save(identity.tenantId, { ...stored, seed, generatedAt: toUtcTimestamp(this.deps.clock()), slots }, version, data);
    return { ...response, regeneration: { changed, kept: kept.size } };
  }

  private async replannedSlots(week: PlanWeek, stored: StoredPlan, kept: ReadonlySet<string>, data: PlanData, seed: number): Promise<StoredPlanSlot[]> {
    const fixed = new Map(stored.slots.filter((slot) => kept.has(slot.slotId)).map((slot) => [slot.slotId, slot.dishId ? (data.byId.get(slot.dishId) ?? null) : null]));
    const result = plan({
      weekStart: week.weekStart,
      dishes: data.dishes.filter((dish) => !dish.archived),
      profile: data.profile,
      context: { recentDishIds: await this.recentDishIds(week.tenantId, week.weekStart) },
      fixed,
      seed,
    });
    const planned = new Map(result.slots.map((slot) => [slot.slotId, slot]));
    return stored.slots.map((slot): StoredPlanSlot => {
      const next = planned.get(slot.slotId);
      if (kept.has(slot.slotId) || !next) return slot;
      return { ...next, locked: false, source: "AUTO", status: "PLANNED" };
    });
  }

  private restoredSlots(stored: StoredPlan, kept: ReadonlySet<string>, restore: readonly RestoredSlot[], data: PlanData): StoredPlanSlot[] {
    const byId = new Map(restore.map((slot) => [slot.slotId, slot.dishId]));
    for (const [slotId, dishId] of byId) {
      if (!stored.slots.some((slot) => slot.slotId === slotId) || kept.has(slotId)) {
        throw new ApplicationError("VALIDATION_ERROR", 400, "Only replanned meals can be restored.", [{ field: "restore", message: `${slotId} cannot be restored.` }]);
      }
      if (dishId !== null && !data.byId.has(dishId)) throw new NotFoundError("Dish not found.");
    }
    return stored.slots.map((slot): StoredPlanSlot => {
      const dishId = byId.get(slot.slotId);
      return dishId === undefined ? slot : { slotId: slot.slotId, dishId, locked: false, source: "AUTO", status: "PLANNED" };
    });
  }

  /** Every active dish for one meal, those that fit all rules first (picker of FOOD-022). */
  async mealOptions(tenantId: string, week: WeekReference, slotId: string): Promise<MealOption[]> {
    const resolved = await this.resolveWeek(tenantId, week);
    const { plan: stored } = await this.requirePlan(tenantId, resolved.weekStart);
    this.requireSlot(stored, slotId, resolved);
    const data = await this.load(tenantId);
    const meals = this.mealsOf(resolved.weekStart, stored, data);
    const hardCount = (violations: readonly Violation[]) => violations.filter((violation) => violation.severity === "HARD").length;
    return data.dishes
      .filter((dish) => !dish.archived)
      .map((dish) => ({ dish: toDishSummary(dish), violations: checkSlot(meals, slotId, dish, data.profile) }))
      .sort((a, b) => hardCount(a.violations) - hardCount(b.violations) || a.violations.length - b.violations.length || a.dish.name.localeCompare(b.dish.name, "de"));
  }

  /**
   * Choose a dish for a meal by hand (manual and locked) and/or lock or unlock it (FOOD-022). Rule violations are
   * allowed and returned as warnings, except allergy and vegetarian conflicts, which need `confirm`.
   */
  async chooseMeal(identity: Identity, week: WeekReference, slotId: string, request: ChooseMealRequest): Promise<MealPlanResponse> {
    const resolved = await this.resolveWeek(identity.tenantId, week);
    const { plan: stored, version } = await this.requirePlan(identity.tenantId, resolved.weekStart);
    const target = this.requireSlot(stored, slotId, resolved);
    const data = await this.load(identity.tenantId);
    let next: StoredPlanSlot = target;
    if (request.dishId !== undefined) {
      const dish = data.byId.get(request.dishId);
      if (!dish || dish.archived) throw new NotFoundError("Dish not found.");
      if (!request.confirm) this.assertNoHarm(checkSlot(this.mealsOf(resolved.weekStart, stored, data), slotId, dish, data.profile));
      next = { slotId, dishId: dish.dishId, locked: true, source: "MANUAL", status: "PLANNED" };
    }
    if (request.locked !== undefined) next = { ...next, locked: request.locked };
    const slots = stored.slots.map((slot) => (slot.slotId === slotId ? next : slot));
    return this.save(identity.tenantId, { ...stored, slots }, version, data);
  }

  /** Swap the dishes of two meals of the week; both become manual and locked (FOOD-022). */
  async swapMeals(identity: Identity, week: WeekReference, request: SwapMealsRequest): Promise<MealPlanResponse> {
    if (request.from === request.to) throw new ApplicationError("VALIDATION_ERROR", 400, "Choose two different meals.", [{ field: "to", message: "Must differ from from." }]);
    const resolved = await this.resolveWeek(identity.tenantId, week);
    const { plan: stored, version } = await this.requirePlan(identity.tenantId, resolved.weekStart);
    const from = this.requireSlot(stored, request.from, resolved);
    const to = this.requireSlot(stored, request.to, resolved);
    const data = await this.load(identity.tenantId);
    const swapped = stored.slots.map((slot): StoredPlanSlot => {
      if (slot.slotId === from.slotId) return { slotId: slot.slotId, dishId: to.dishId, locked: true, source: "MANUAL", status: "PLANNED" };
      if (slot.slotId === to.slotId) return { slotId: slot.slotId, dishId: from.dishId, locked: true, source: "MANUAL", status: "PLANNED" };
      return slot;
    });
    if (!request.confirm) {
      const meals = this.mealsOf(resolved.weekStart, { ...stored, slots: swapped }, data);
      this.assertNoHarm(checkWeek(meals, data.profile).filter((violation) => violation.slotIds.includes(from.slotId) || violation.slotIds.includes(to.slotId)));
    }
    return this.save(identity.tenantId, { ...stored, slots: swapped }, version, data);
  }

  private assertNoHarm(violations: readonly Violation[]): void {
    const harmful = violations.filter((violation) => CONFIRM_RULES.has(violation.rule));
    if (harmful.length > 0) throw new ApplicationError(
        "CONFIRMATION_REQUIRED",
        409,
        harmful.map((violation) => violation.message).join(" "),
        harmful.map((violation) => ({ field: violation.rule, message: violation.message })),
      );
  }

  /** Stored plan or 404 (changes need an existing plan). */
  async requirePlan(tenantId: string, weekStart: string): Promise<{ plan: StoredPlan; version: number }> {
    const stored = await this.storedPlan(tenantId, weekStart);
    if (!stored) throw new NotFoundError("No meal plan for this week.");
    return stored;
  }

  /** The slot of the plan; past meals cannot be changed. */
  requireSlot(stored: StoredPlan, slotId: string, week: PlanWeek): StoredPlanSlot {
    const parsed = parseSlotId(slotId);
    const slot = stored.slots.find((candidate) => candidate.slotId === slotId);
    if (!parsed || !slot) throw new NotFoundError("Meal not found in this plan.");
    if (parsed.date < week.today) throw new ApplicationError("MEAL_IN_PAST", 400, "Past meals cannot be changed.");
    return slot;
  }

  mealsOf(weekStart: string, stored: StoredPlan, data: PlanData): PlannedMeal[] {
    const byId = new Map(stored.slots.map((slot) => [slot.slotId, slot.dishId]));
    return emptyWeek(weekStart).map((meal) => {
      const dishId = byId.get(meal.slotId);
      return { ...meal, dish: dishId ? (data.byId.get(dishId) ?? null) : null };
    });
  }

  /** Write a changed plan with optimistic locking and return the response. */
  async save(tenantId: string, changed: StoredPlan, version: number, data: PlanData): Promise<MealPlanResponse> {
    await this.deps.store.put(tenantId, itemKey("PLAN", changed.weekStart), { ...changed, expiresAt: this.expiresAt(changed.weekStart) }, version);
    return this.toResponse(changed.weekStart, changed, data);
  }

  private noAlternativeMessage(meals: readonly PlannedMeal[], slotId: string, candidates: readonly DishResponse[], data: PlanData): string {
    const counts = new Map<RuleId, number>();
    for (const dish of candidates) {
      const first = checkSlot(meals, slotId, dish, data.profile).find((violation) => violation.severity === "HARD");
      if (first) counts.set(first.rule, (counts.get(first.rule) ?? 0) + 1);
    }
    const rules = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([rule]) => RULE_NAMES[rule]);
    return rules.length > 0 ? `Kein anderes Gericht passt (Regeln: ${rules.join(", ")}).` : "Kein anderes Gericht passt.";
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

/** German names of the rules for „no alternative“ messages. */
const RULE_NAMES: Readonly<Record<RuleId, string>> = {
  SLOT: "Mahlzeit",
  R1: "Allergien",
  R2: "vegetarisch",
  R3: "Abneigungen",
  R4: "Kochzeit",
  R5: "Hühnchen",
  R6: "Burger",
  R7: "Proteinquelle",
  R8: "Grundzutat am Tag",
  R9: "mittags leicht",
  R10: "abends warm",
  R11: "Salat",
  R12: "Abwechslung",
  R13: "familientauglich",
};

export interface ReplaceMealRequest {
  /** Dishes already rejected in this session (FOOD-007 cycles through alternatives). */
  readonly excludeDishIds?: readonly string[];
  /** Put exactly this dish back (undo); must not break a hard rule. */
  readonly dishId?: string;
}

export interface RestoredSlot {
  readonly slotId: string;
  readonly dishId: string | null;
}

export interface RegenerateWeekRequest {
  /** Undo: the previous dishes of the replanned meals (kept meals cannot be restored). */
  readonly restore?: readonly RestoredSlot[];
}

export interface RegeneratedPlanResponse extends MealPlanResponse {
  /** Meals whose dish changed, and meals kept as they were (locked, manual, cooked, past). */
  readonly regeneration: { readonly changed: number; readonly kept: number };
}

/** Meals that regenerating keeps (FOOD-008): locked or chosen by hand, already cooked, or in the past. */
export const isKept = (slot: StoredPlanSlot, today: string): boolean =>
  slot.locked || slot.source === "MANUAL" || slot.status === "COOKED" || slot.slotId.slice(0, 10) < today;

export interface ChooseMealRequest {
  readonly dishId?: string;
  readonly locked?: boolean;
  /** Required when the choice conflicts with an allergy or a vegetarian (R1, R2). */
  readonly confirm?: boolean;
}

export interface SwapMealsRequest {
  readonly from: string;
  readonly to: string;
  readonly confirm?: boolean;
}

export interface MealOption {
  readonly dish: DishSummary;
  /** What the dish would break at this meal; empty = fits every rule. */
  readonly violations: readonly Violation[];
}

/** Rules that can harm someone: a manual choice that breaks them needs a confirmation (FOOD-022). */
const CONFIRM_RULES: ReadonlySet<RuleId> = new Set(["R1", "R2"]);

const isReady = (data: PlanData): boolean => data.dishes.some((dish) => !dish.archived) && data.profile.eaters.length > 0;

/** Stored plan; the store holds only values written by this service. */
export function toStoredPlan(item: MealItem): StoredPlan {
  const data = item.data as unknown as StoredPlan;
  return { weekStart: data.weekStart, seed: data.seed, generatedAt: data.generatedAt, slots: data.slots };
}
