/**
 * Shopping list per week (FOOD-014), stored as LIST#<weekStart>. Created on first read from the week's plan; a refresh
 * recalculates it and keeps ticks, own items and the own order; changes from several phones are merged by retrying
 * against the newest version (the operations are idempotent).
 */

import type { Identity } from "../../auth/index.js";
import { ConflictError } from "../../exceptions/index.js";
import { toUtcTimestamp, type Clock } from "../../utils/clock.js";
import { itemKey } from "../keys.js";
import type { ResolvedIngredient } from "../models/ingredient.js";
import type { MealsStore } from "../repositories/meals-store.js";
import { applyOperations, generateItems, mergeRefresh, signatureOf, type ShoppingItem, type ShoppingOperation, type ShoppingRange, type StoredShoppingList } from "../shopping/shopping-list.js";
import type { MealPlanService, PlanWeek, WeekReference } from "./meal-plan.service.js";

/** Parallel changes from two phones: retries against the newest version before giving up with 409. */
const MAX_ATTEMPTS = 3;

export interface ShoppingListServiceDependencies {
  readonly store: MealsStore;
  readonly plans: Pick<MealPlanService, "resolveWeek" | "requirePlan" | "load" | "expiresAt">;
  readonly ingredientsOf: (tenantId: string) => Promise<ReadonlyMap<string, ResolvedIngredient>>;
  readonly clock: Clock;
}

export interface ShoppingListResponse {
  readonly weekStart: string;
  readonly range: ShoppingRange;
  readonly generatedAt: string;
  /** The plan changed since the list was made: „Liste aktualisieren“. */
  readonly stale: boolean;
  readonly items: readonly ShoppingItem[];
}

export class ShoppingListService {
  constructor(private readonly deps: ShoppingListServiceDependencies) {}

  /** The week's list; made from the plan on first read (404 while the week has no plan). */
  async getList(tenantId: string, week: WeekReference): Promise<ShoppingListResponse> {
    const resolved = await this.deps.plans.resolveWeek(tenantId, week);
    const stored = await this.stored(tenantId, resolved.weekStart);
    const items = await this.generate(resolved, stored?.list.range ?? "REST");
    if (stored) return this.toResponse(stored.list, items);
    const created: StoredShoppingList = this.newList(resolved.weekStart, "REST", items);
    try {
      await this.deps.store.put(tenantId, itemKey("LIST", resolved.weekStart), this.itemData(created));
      return this.toResponse(created, items);
    } catch (error) {
      // Made by the other phone at the same moment: use that one.
      if (error instanceof ConflictError) {
        const existing = await this.stored(tenantId, resolved.weekStart);
        if (existing) return this.toResponse(existing.list, items);
      }
      throw error;
    }
  }

  /** Recalculate after plan changes, optionally with another range; keeps ticks, own items and order. */
  async refreshList(identity: Identity, week: WeekReference, range?: ShoppingRange): Promise<ShoppingListResponse> {
    const resolved = await this.deps.plans.resolveWeek(identity.tenantId, week);
    return this.change(resolved, async (current) => {
      const nextRange = range ?? current?.range ?? "REST";
      const generated = await this.generate(resolved, nextRange);
      return { ...this.newList(resolved.weekStart, nextRange, generated), items: mergeRefresh(current?.items ?? [], generated) };
    });
  }

  /** Ticks, own items, removals and moves from the clients (also replayed offline queues). */
  async changeList(identity: Identity, week: WeekReference, operations: readonly ShoppingOperation[]): Promise<ShoppingListResponse> {
    const resolved = await this.deps.plans.resolveWeek(identity.tenantId, week);
    return this.change(resolved, async (current) => {
      const list = current ?? this.newList(resolved.weekStart, "REST", await this.generate(resolved, "REST"));
      return { ...list, items: applyOperations(list.items, operations) };
    });
  }

  /** Read, change and write with optimistic locking; a parallel change is retried on the newer version. */
  private async change(week: PlanWeek, update: (current: StoredShoppingList | undefined) => Promise<StoredShoppingList>): Promise<ShoppingListResponse> {
    for (let attempt = 1; ; attempt += 1) {
      const stored = await this.stored(week.tenantId, week.weekStart);
      const changed = await update(stored?.list);
      try {
        await this.deps.store.put(week.tenantId, itemKey("LIST", week.weekStart), this.itemData(changed), stored?.version);
        return this.toResponse(changed, await this.generate(week, changed.range));
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  }

  private async generate(week: PlanWeek, range: ShoppingRange): Promise<ShoppingItem[]> {
    const { plan } = await this.deps.plans.requirePlan(week.tenantId, week.weekStart);
    const [data, ingredients] = await Promise.all([this.deps.plans.load(week.tenantId), this.deps.ingredientsOf(week.tenantId)]);
    return generateItems({
      weekStart: week.weekStart,
      slots: plan.slots,
      dishes: data.byId,
      ingredients,
      profile: data.profile,
      from: range === "WEEK" ? week.weekStart : week.today,
    });
  }

  private newList(weekStart: string, range: ShoppingRange, items: readonly ShoppingItem[]): StoredShoppingList {
    return { weekStart, range, generatedAt: toUtcTimestamp(this.deps.clock()), signature: signatureOf(items), items };
  }

  private itemData(list: StoredShoppingList): Record<string, unknown> {
    return { ...list, expiresAt: this.deps.plans.expiresAt(list.weekStart) };
  }

  private async stored(tenantId: string, weekStart: string): Promise<{ list: StoredShoppingList; version: number } | undefined> {
    const item = await this.deps.store.get(tenantId, itemKey("LIST", weekStart));
    return item ? { list: toStoredList(item.data), version: item.version } : undefined;
  }

  private toResponse(list: StoredShoppingList, fresh: readonly ShoppingItem[]): ShoppingListResponse {
    return { weekStart: list.weekStart, range: list.range, generatedAt: list.generatedAt, stale: signatureOf(fresh) !== list.signature, items: list.items };
  }
}

/** Stored list; the store holds only values written by this service. */
function toStoredList(data: Record<string, unknown>): StoredShoppingList {
  return {
    weekStart: String(data.weekStart),
    range: data.range === "WEEK" ? "WEEK" : "REST",
    generatedAt: String(data.generatedAt),
    signature: String(data.signature),
    items: Array.isArray(data.items) ? (data.items as ShoppingItem[]) : [],
  };
}
