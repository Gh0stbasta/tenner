/**
 * Echo Show home-screen widgets (ALEXA-007, FOOD-018, FOOD-026): a small household summary (`tenner/status`), today's
 * meals (`tenner/meals`, „Morgen“ from 20:00 household time) and the open shopping list (`tenner/shopping`) pushed with the Data Store API after every change (debounced to
 * one push per minute), at the start of each household day and at 20:00. The widgets render from the pushed data only;
 * they never call the skill.
 */

import type { DashboardRequest, DashboardResponse } from "../dto/index.js";
import type { MealSlot } from "../meals/models/dish.js";
import type { HouseholdMember } from "../models/index.js";
import { deliveryRecord, type DeliveryLog } from "../notifications/delivery.js";
import { localTime } from "../notifications/schedule.js";
import type { Logger } from "../utils/logger.js";
import { DATASTORE_SCOPE, MEALS_KEY, SHOPPING_KEY, WIDGET_KEY, type DataStoreClient, type DataStoreObject } from "./datastore-client.js";
import type { LwaTokenClient } from "./lwa-client.js";

export const DEBOUNCE_MS = 60_000;
export const WIDGET_NEXT_ITEMS = 2;
/** From this household hour the meal widget shows tomorrow (after dinner). */
export const MEAL_WIDGET_EVENING_HOUR = 20;
/** Shown for an empty meal. */
export const NO_MEAL = "–";

export interface WidgetSummary {
  readonly date: string;
  readonly dueToday: number;
  readonly openMinutes: number;
  readonly overdue: number;
  readonly next: readonly { readonly title: string; readonly minutes: number; readonly member: string }[];
  readonly members: readonly { readonly name: string; readonly count: number }[];
  readonly updatedAt: string;
}

/** Payload for the widget: counts, next two Tenners (overdue first), per-member counts. No IDs. */
export function widgetSummary(dashboard: DashboardResponse, members: readonly HouseholdMember[], now: Date): WidgetSummary {
  const nameOf = (userId: string) => (userId === "HOUSEHOLD" ? "Alle" : (members.find((member) => member.userId === userId)?.displayName ?? userId));
  const next = [...dashboard.overdue, ...dashboard.dueToday].slice(0, WIDGET_NEXT_ITEMS);
  return {
    date: dashboard.referenceDate,
    dueToday: dashboard.summary.dueTodayCount,
    openMinutes: dashboard.summary.totalActionableMinutes,
    overdue: dashboard.summary.overdueCount,
    next: next.map((tenner) => ({ title: tenner.title, minutes: tenner.estimatedMinutes, member: nameOf(tenner.assignedTo) })),
    members: members
      .filter((member) => member.active)
      .map((member) => ({ name: member.displayName, count: dashboard.byUser[member.userId]?.count ?? 0 }))
      .filter((entry) => entry.count > 0),
    updatedAt: now.toISOString(),
  };
}

/** One planned meal of a day, as the meal plan returns it (dish null = nothing planned). */
export interface DayMeal {
  readonly slot: MealSlot;
  readonly dish: { readonly name: string } | null;
}

export interface MealWidget {
  /** „Heute“ until 20:00 household time, then „Morgen“. */
  readonly title: string;
  readonly date: string;
  readonly lunch: string;
  readonly dinner: string;
  readonly updatedAt: string;
}

/** The household day the meal widget shows and its title: today, or tomorrow from 20:00. */
export function mealDay(now: Date, timezone: string): { readonly date: string; readonly title: string } {
  const local = localTime(now, timezone);
  if (local.minutes < MEAL_WIDGET_EVENING_HOUR * 60) return { date: local.date, title: "Heute" };
  const next = new Date(Date.parse(`${local.date}T00:00:00Z`) + 24 * 60 * 60_000).toISOString().slice(0, 10);
  return { date: next, title: "Morgen" };
}

/** Payload for the meal widget: dish names only, „–“ for an empty meal. */
export function mealWidget(day: { readonly date: string; readonly title: string }, meals: readonly DayMeal[], now: Date): MealWidget {
  const nameOf = (slot: MealSlot) => meals.find((meal) => meal.slot === slot)?.dish?.name ?? NO_MEAL;
  return { title: day.title, date: day.date, lunch: nameOf("LUNCH"), dinner: nameOf("DINNER"), updatedAt: now.toISOString() };
}

/** Day and part of day (before/after 20:00): a new phase means the meal widget shows another day. */
const phaseOf = (now: Date, timezone: string): string => {
  const local = localTime(now, timezone);
  return `${local.date}#${local.minutes < MEAL_WIDGET_EVENING_HOUR * 60 ? "DAY" : "EVENING"}`;
};

/** Shopping list widget (FOOD-026): items shown at once, the rest is counted. */
export const SHOPPING_WIDGET_ITEMS = 6;

/** What the widget needs of a shopping list item (FOOD-014, counts since FOOD-028). */
export interface ShoppingListEntry {
  readonly name: string;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly checked: boolean;
  readonly pantry: boolean;
}

export interface ShoppingWidget {
  /** Open items without the pantry (salt, oil). */
  readonly open: number;
  /** „2× Nudeln“, „Milch“ in the list's order. */
  readonly items: readonly string[];
  readonly more: number;
  readonly updatedAt: string;
}

/** Payload for the shopping list widget: open items in the household's order, counts only (FOOD-028). */
export function shoppingWidget(entries: readonly ShoppingListEntry[], now: Date): ShoppingWidget {
  const open = entries.filter((entry) => !entry.checked && !entry.pantry);
  const line = (entry: ShoppingListEntry) => (entry.quantity !== null && entry.quantity > 1 && entry.unit === "Stück" ? `${entry.quantity}× ${entry.name}` : entry.name);
  const items = open.slice(0, SHOPPING_WIDGET_ITEMS).map(line);
  return { open: open.length, items, more: open.length - items.length, updatedAt: now.toISOString() };
}

export interface WidgetPushDependencies {
  readonly alexaUsers: (tenantId: string) => Promise<readonly string[]>;
  readonly removeAlexaUser: (tenantId: string, alexaUserId: string) => Promise<void>;
  readonly dashboard: (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;
  readonly members: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  /** FOOD-018: the meals of one household date; undefined without meal planning (only the status is pushed). */
  readonly mealsOn?: ((tenantId: string, date: string) => Promise<readonly DayMeal[]>) | undefined;
  /** FOOD-026: this week's shopping list (empty without a plan); undefined without meal planning. */
  readonly shoppingList?: ((tenantId: string) => Promise<readonly ShoppingListEntry[]>) | undefined;
  readonly lwa: LwaTokenClient;
  readonly dataStore: DataStoreClient;
  readonly log: Pick<DeliveryLog, "get" | "mark">;
  readonly logger: Logger;
  readonly now: () => Date;
}

const lastKey = (tenantId: string) => `${tenantId}#WIDGET#LAST`;
const dirtyKey = (tenantId: string) => `${tenantId}#WIDGET#DIRTY`;

export class WidgetPushService {
  constructor(private readonly deps: WidgetPushDependencies) {}

  /** A household change (API write): push now, or mark dirty when the last push was less than a minute ago. */
  async onChange(tenantId: string): Promise<void> {
    const now = this.deps.now();
    const last = await this.deps.log.get(lastKey(tenantId));
    if (last && now.getTime() - Date.parse(last.createdAt) < DEBOUNCE_MS) {
      await this.mark(dirtyKey(tenantId), tenantId, now);
      this.deps.logger.debug("Widget push debounced", { event: "WidgetPushDebounced" });
      return;
    }
    await this.push(tenantId, now, "CHANGE");
  }

  /**
   * Scheduled run: push at the start of a new household day, at 20:00 (the meal widget switches to tomorrow), or when
   * a debounced change is still pending.
   */
  async onSchedule(tenantId: string): Promise<void> {
    const now = this.deps.now();
    const timezone = await this.deps.timezoneOf(tenantId);
    const last = await this.deps.log.get(lastKey(tenantId));
    const dirty = await this.deps.log.get(dirtyKey(tenantId));
    const newDay = last === undefined || localTime(new Date(last.createdAt), timezone).date !== localTime(now, timezone).date;
    const evening = !newDay && last !== undefined && phaseOf(new Date(last.createdAt), timezone) !== phaseOf(now, timezone);
    const pending = dirty !== undefined && (last === undefined || Date.parse(dirty.createdAt) > Date.parse(last.createdAt));
    if (newDay || evening || pending) await this.push(tenantId, now, newDay ? "DAY_START" : evening ? "EVENING" : "PENDING_CHANGE");
  }

  private async push(tenantId: string, now: Date, reason: string): Promise<void> {
    const users = await this.deps.alexaUsers(tenantId);
    if (users.length === 0) return;
    const [dashboard, members] = await Promise.all([this.deps.dashboard(tenantId, {}), this.deps.members(tenantId)]);
    const objects: DataStoreObject[] = [{ key: WIDGET_KEY, content: widgetSummary(dashboard, members, now) }];
    const meals = await this.meals(tenantId, now);
    if (meals !== undefined) objects.push({ key: MEALS_KEY, content: meals });
    const shopping = await this.shopping(tenantId, now);
    if (shopping !== undefined) objects.push({ key: SHOPPING_KEY, content: shopping });
    const token = await this.deps.lwa.token(DATASTORE_SCOPE);
    let pushed = 0;
    for (const alexaUserId of users) {
      let outcome = await this.deps.dataStore.putObjects(token, alexaUserId, objects);
      if (!outcome.ok && !outcome.userGone) outcome = await this.deps.dataStore.putObjects(token, alexaUserId, objects); // retry once
      if (outcome.ok) {
        pushed += 1;
      } else if (outcome.userGone) {
        await this.deps.removeAlexaUser(tenantId, alexaUserId);
        this.deps.logger.info("Alexa user removed from widget targets", { event: "WidgetTargetRemoved", status: outcome.status });
      } else {
        this.deps.logger.warn("Widget push failed", { event: "WidgetPushFailed", status: outcome.status });
      }
    }
    await this.mark(lastKey(tenantId), tenantId, now);
    this.deps.logger.info("Widget pushed", { event: "WidgetPushed", reason, targets: users.length, pushed });
  }

  /** FOOD-018: a failing meal plan never blocks the status widget; the meal widget keeps its last data. */
  private async meals(tenantId: string, now: Date): Promise<MealWidget | undefined> {
    if (this.deps.mealsOn === undefined) return undefined;
    try {
      const day = mealDay(now, await this.deps.timezoneOf(tenantId));
      return mealWidget(day, await this.deps.mealsOn(tenantId, day.date), now);
    } catch (error) {
      this.deps.logger.warn("Meal widget data unavailable", { event: "MealWidgetFailed", error: error instanceof Error ? error.name : "UnknownError" });
      return undefined;
    }
  }

  /** FOOD-026: like the meal widget, a failure never blocks the other widgets. */
  private async shopping(tenantId: string, now: Date): Promise<ShoppingWidget | undefined> {
    if (this.deps.shoppingList === undefined) return undefined;
    try {
      return shoppingWidget(await this.deps.shoppingList(tenantId), now);
    } catch (error) {
      this.deps.logger.warn("Shopping widget data unavailable", { event: "ShoppingWidgetFailed", error: error instanceof Error ? error.name : "UnknownError" });
      return undefined;
    }
  }

  private async mark(key: string, tenantId: string, now: Date): Promise<void> {
    await this.deps.log.mark(deliveryRecord(key, { type: "WIDGET", channel: "ALEXA", userId: tenantId }, now, "SENT"));
  }
}
