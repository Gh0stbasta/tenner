/** In-memory meals table (FOOD-001) with the store's condition semantics, for meal service tests. */

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DocumentCommand, DocumentSender } from "../../src/clients/dynamodb.js";
import {
  CATALOG_DISHES,
  CATALOG_INGREDIENTS,
  DEFAULT_HOUSEHOLD_FOOD_RULES,
  deriveDish,
  MealsStore,
  type DishResponse,
  type Eater,
  type FoodProfile,
  type ResolvedIngredient,
} from "../../src/meals/index.js";

const conditionFailed = (): Error => Object.assign(new Error("The conditional request failed"), { name: "ConditionalCheckFailedException" });

export interface InMemoryMeals {
  readonly store: MealsStore;
  /** Stored items by `${tenantId}|${itemKey}`. */
  readonly items: Map<string, Record<string, unknown>>;
  readonly sender: DocumentSender;
}

export function inMemoryMeals(): InMemoryMeals {
  const items = new Map<string, Record<string, unknown>>();
  const key = (tenantId: unknown, itemKey: unknown): string => `${String(tenantId)}|${String(itemKey)}`;
  const sender: DocumentSender = {
    send: async (command: DocumentCommand) => {
      if (command instanceof GetCommand) {
        const item = items.get(key(command.input.Key?.tenantId, command.input.Key?.itemKey));
        return item ? { Item: structuredClone(item) } : {};
      }
      if (command instanceof QueryCommand) {
        const values = command.input.ExpressionAttributeValues ?? {};
        const matches = [...items.values()]
          .filter((item) => item.tenantId === values[":tenantId"] && String(item.itemKey).startsWith(String(values[":prefix"])))
          .sort((a, b) => String(a.itemKey).localeCompare(String(b.itemKey)));
        return { Items: matches.map((item) => structuredClone(item)) };
      }
      if (command instanceof PutCommand) {
        const item = command.input.Item ?? {};
        const id = key(item.tenantId, item.itemKey);
        const existing = items.get(id);
        if (command.input.ConditionExpression === "attribute_not_exists(itemKey)" && existing) throw conditionFailed();
        if (command.input.ConditionExpression === "version = :expected" && existing?.version !== command.input.ExpressionAttributeValues?.[":expected"]) throw conditionFailed();
        items.set(id, structuredClone(item));
        return {};
      }
      throw new Error(`Unsupported command ${command.constructor.name}`);
    },
  };
  return { store: new MealsStore(sender, "tenner-meals"), items, sender };
}

const CATALOG_INGREDIENT_MAP: ReadonlyMap<string, ResolvedIngredient> = new Map(CATALOG_INGREDIENTS.map((entry) => [entry.ingredientId, { ...entry, source: "CATALOG", overridden: false }]));

/** The seed catalog as API dishes with stable IDs (dish-01 …), for rules and planner tests. */
export function catalogDishResponses(): DishResponse[] {
  return CATALOG_DISHES.map((seed, index) => {
    const dish = {
      ...seed,
      dishId: `dish-${String(index + 1).padStart(2, "0")}`,
      ingredients: seed.ingredients.map((entry) => ({ ...entry, optional: entry.optional ?? false })),
      familyFriendly: true,
      isBurger: seed.isBurger ?? false,
      favorite: false,
      archived: false,
      createdAt: "2026-10-07T10:00:00Z",
      updatedAt: "2026-10-07T10:00:00Z",
    } as unknown as DishResponse;
    return { ...dish, ...deriveDish(dish, CATALOG_INGREDIENT_MAP) };
  });
}

export function dishNamed(dishes: readonly DishResponse[], name: string): DishResponse {
  const dish = dishes.find((candidate) => candidate.name === name);
  if (!dish) throw new Error(`No catalog dish ${name}`);
  return dish;
}

const eater = (overrides: Partial<Eater> & Pick<Eater, "eaterId" | "name" | "type">): Eater => ({
  portionFactor: overrides.type === "ADULT" ? 1 : 0.5,
  diet: "OMNIVORE",
  vegetarianExceptions: [],
  allergies: [],
  dislikeTags: [],
  dislikeIngredients: [],
  likeIngredients: [],
  likeGroups: [],
  ...overrides,
});

/** The owner's family as roles (EPIC-FOOD-001): one adult with allergies, one vegetarian adult, three children. */
export function familyProfile(household: Partial<FoodProfile["household"]> = {}): FoodProfile {
  return {
    eaters: [
      eater({ eaterId: "a1", name: "Erwachsener 1", type: "ADULT", allergies: ["NUTS", "APPLE"] }),
      eater({ eaterId: "a2", name: "Erwachsener 2", type: "ADULT", diet: "VEGETARIAN", vegetarianExceptions: ["MINCE", "SAUSAGE"] }),
      eater({ eaterId: "k1", name: "Kind 1", type: "CHILD" }),
      eater({ eaterId: "k2", name: "Kind 2", type: "CHILD" }),
      eater({ eaterId: "k3", name: "Kind 3", type: "CHILD" }),
    ],
    household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, ...household },
    updatedAt: "2026-10-07T10:00:00Z",
  };
}
