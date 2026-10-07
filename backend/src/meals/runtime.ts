/** Wiring of the meal services on one meals table (API and notifier share it). */

import type { DocumentSender } from "../clients/dynamodb.js";
import type { WeekStart } from "../models/enums.js";
import type { HouseholdMember } from "../models/index.js";
import type { Clock, IdGenerator } from "../utils/clock.js";
import { MealsStore } from "./repositories/meals-store.js";
import { DishService } from "./services/dish.service.js";
import { IngredientService } from "./services/ingredient.service.js";
import { MealCatalogImportService } from "./services/meal-catalog-import.service.js";
import { MealPlanService } from "./services/meal-plan.service.js";
import { ProfileService } from "./services/profile.service.js";

export interface MealServices {
  readonly ingredients: IngredientService;
  readonly dishes: DishService;
  readonly profiles: ProfileService;
  readonly catalog: MealCatalogImportService;
  readonly plans: MealPlanService;
}

export interface MealServicesDependencies {
  readonly client: DocumentSender;
  readonly tableName: string;
  readonly membersOf: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly settingsOf: (tenantId: string) => Promise<{ readonly timezone: string; readonly weekStartsOn: WeekStart }>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export function createMealServices(deps: MealServicesDependencies): MealServices {
  const store = new MealsStore(deps.client, deps.tableName);
  const ingredients = new IngredientService(store, deps.clock);
  const ingredientsOf = (tenantId: string) => ingredients.ingredientsOf(tenantId);
  const dishes = new DishService(store, ingredientsOf, deps.clock, deps.ids);
  const profiles = new ProfileService({ store, ingredientsOf, membersOf: deps.membersOf, clock: deps.clock, ids: deps.ids });
  const catalog = new MealCatalogImportService({ dishesOf: (tenantId) => dishes.dishesOf(tenantId), createDish: (identity, request) => dishes.createDish(identity, request) });
  const plans = new MealPlanService({
    store,
    dishesOf: (tenantId) => dishes.allDishes(tenantId),
    profileOf: (tenantId) => profiles.getProfile(tenantId),
    settingsOf: deps.settingsOf,
    clock: deps.clock,
  });
  return { ingredients, dishes, profiles, catalog, plans };
}
