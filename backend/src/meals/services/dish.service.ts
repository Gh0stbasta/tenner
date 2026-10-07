/** Dishes (FOOD-002): validated, tenant-scoped CRUD with archive and restore; derived values on every read. */

import type { Identity } from "../../auth/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../../exceptions/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../../utils/clock.js";
import { idOfItemKey, itemKey, itemKeyPrefix } from "../keys.js";
import { deriveDish, ingredientErrors, type Dish, type DishResponse } from "../models/dish.js";
import type { ResolvedIngredient } from "../models/ingredient.js";
import type { MealItem, MealItemData, MealsStore } from "../repositories/meals-store.js";
import type { CreateDishRequest, ListDishesQuery, UpdateDishRequest } from "../validators.js";

export type IngredientsOf = (tenantId: string) => Promise<ReadonlyMap<string, ResolvedIngredient>>;

const nameKey = (name: string): string => name.trim().toLocaleLowerCase("de");

/** Optional fields that `null` removes in an update. */
const CLEARABLE_FIELDS = ["group", "vegetarianVariant", "proteinSourcesOverride", "baseTagsOverride", "nutritionOverride", "costOverride"] as const;

/** A stored dish; the store holds only values written by this service. */
function toDish(item: MealItem): Dish {
  const dishId = idOfItemKey("DISH", item.itemKey) ?? "";
  return { ...(item.data as unknown as Omit<Dish, "dishId">), dishId };
}

function withoutNulls(data: MealItemData): MealItemData {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));
}

export class DishService {
  constructor(
    private readonly store: MealsStore,
    private readonly ingredientsOf: IngredientsOf,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Dishes sorted by name; archived ones only on request. */
  async listDishes(tenantId: string, query: ListDishesQuery = {}): Promise<DishResponse[]> {
    const [dishes, ingredients] = await Promise.all([this.dishesOf(tenantId), this.ingredientsOf(tenantId)]);
    return dishes
      .filter((dish) => dish.archived === (query.archived ?? false))
      .filter((dish) => query.slot === undefined || dish.slots.includes(query.slot))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((dish) => ({ ...dish, ...deriveDish(dish, ingredients) }));
  }

  /** All stored dishes (also archived), without derived values. */
  async dishesOf(tenantId: string): Promise<Dish[]> {
    return (await this.store.query(tenantId, itemKeyPrefix("DISH"))).map(toDish);
  }

  async getDish(tenantId: string, dishId: string): Promise<DishResponse> {
    const [item, ingredients] = await Promise.all([this.load(tenantId, dishId), this.ingredientsOf(tenantId)]);
    const dish = toDish(item);
    return { ...dish, ...deriveDish(dish, ingredients) };
  }

  async createDish(identity: Identity, request: CreateDishRequest): Promise<DishResponse> {
    const [dishes, ingredients] = await Promise.all([this.dishesOf(identity.tenantId), this.ingredientsOf(identity.tenantId)]);
    this.assertIngredients(request.ingredients, ingredients);
    this.assertNameFree(dishes, request.name);
    const dishId = this.ids();
    const timestamp = toUtcTimestamp(this.clock());
    const data = withoutNulls({
      ...request,
      name: request.name.trim(),
      totalMinutes: request.totalMinutes ?? request.activeMinutes,
      archived: false,
      createdAt: timestamp,
      createdBy: identity.userId,
      updatedAt: timestamp,
      updatedBy: identity.userId,
    });
    const item = await this.store.put(identity.tenantId, itemKey("DISH", dishId), data);
    const dish = toDish(item);
    return { ...dish, ...deriveDish(dish, ingredients) };
  }

  /** Change any fields; `null` removes optional ones. */
  async updateDish(identity: Identity, dishId: string, request: UpdateDishRequest): Promise<DishResponse> {
    const stored = await this.load(identity.tenantId, dishId);
    const current = toDish(stored);
    const ingredients = await this.ingredientsOf(identity.tenantId);
    if (request.ingredients) this.assertIngredients(request.ingredients, ingredients);
    if (request.name !== undefined && nameKey(request.name) !== nameKey(current.name) && !current.archived) {
      this.assertNameFree(await this.dishesOf(identity.tenantId), request.name, dishId);
    }
    const cleared = new Set<string>(CLEARABLE_FIELDS.filter((field) => request[field] === null));
    const merged: MealItemData = Object.fromEntries(
      Object.entries({ ...stored.data, ...request, ...(request.name === undefined ? {} : { name: request.name.trim() }) }).filter(([key]) => !cleared.has(key)),
    );
    if (typeof merged.activeMinutes === "number" && typeof merged.totalMinutes === "number" && merged.totalMinutes < merged.activeMinutes) {
      throw new ValidationError("Validation failed.", [{ field: "totalMinutes", message: "Total time must not be below the active time." }]);
    }
    const item = await this.store.put(identity.tenantId, stored.itemKey, { ...merged, updatedAt: toUtcTimestamp(this.clock()), updatedBy: identity.userId }, stored.version);
    const dish = toDish(item);
    return { ...dish, ...deriveDish(dish, ingredients) };
  }

  /** Archived dishes are no longer planned; existing plans keep their reference. */
  async archiveDish(identity: Identity, dishId: string): Promise<DishResponse> {
    return this.setArchived(identity, dishId, true);
  }

  async restoreDish(identity: Identity, dishId: string): Promise<DishResponse> {
    return this.setArchived(identity, dishId, false);
  }

  private async setArchived(identity: Identity, dishId: string, archived: boolean): Promise<DishResponse> {
    const stored = await this.load(identity.tenantId, dishId);
    const current = toDish(stored);
    if (!archived && current.archived) this.assertNameFree(await this.dishesOf(identity.tenantId), current.name, dishId);
    const item =
      current.archived === archived
        ? stored
        : await this.store.put(identity.tenantId, stored.itemKey, { ...stored.data, archived, updatedAt: toUtcTimestamp(this.clock()), updatedBy: identity.userId }, stored.version);
    const dish = toDish(item);
    return { ...dish, ...deriveDish(dish, await this.ingredientsOf(identity.tenantId)) };
  }

  private async load(tenantId: string, dishId: string): Promise<MealItem> {
    const item = await this.store.get(tenantId, itemKey("DISH", dishId));
    if (!item) throw new NotFoundError("Dish not found.");
    return item;
  }

  private assertIngredients(entries: CreateDishRequest["ingredients"], ingredients: ReadonlyMap<string, ResolvedIngredient>): void {
    const errors = ingredientErrors(entries, ingredients);
    if (errors.length > 0) throw new ValidationError("Validation failed.", errors);
  }

  /** Names are unique among active dishes (case-insensitive). */
  private assertNameFree(dishes: readonly Dish[], name: string, exceptDishId?: string): void {
    const key = nameKey(name);
    if (dishes.some((dish) => !dish.archived && dish.dishId !== exceptDishId && nameKey(dish.name) === key)) {
      throw new ConflictError("A dish with this name already exists.", "DISH_NAME_TAKEN");
    }
  }
}
