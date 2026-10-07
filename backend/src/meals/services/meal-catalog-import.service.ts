/**
 * Dish catalog import (FOOD-003): adds the family dish catalog through the regular dish service (validation, IDs,
 * derived values). Idempotent: dishes whose name exists (any case, also archived) are skipped and never changed.
 */

import type { Identity } from "../../auth/index.js";
import { CATALOG_DISHES, type SeedDish } from "../catalog/dishes.js";
import type { Dish } from "../models/dish.js";
import type { CreateDishRequest } from "../validators.js";

export interface MealCatalogImportResult {
  readonly dryRun: boolean;
  readonly dishesCreated: readonly string[];
  readonly dishesSkipped: readonly string[];
}

export interface MealCatalogImportDependencies {
  readonly dishesOf: (tenantId: string) => Promise<readonly Dish[]>;
  readonly createDish: (identity: Identity, request: CreateDishRequest) => Promise<unknown>;
  readonly catalog?: readonly SeedDish[];
}

const nameKey = (name: string): string => name.trim().toLocaleLowerCase("de");

function toCreateRequest(seed: SeedDish): CreateDishRequest {
  const { proteinSourcesOverride, baseTagsOverride, ...rest } = seed;
  return {
    ...rest,
    slots: [...seed.slots],
    ingredients: seed.ingredients.map((entry) => ({ ...entry, optional: entry.optional ?? false })),
    familyFriendly: true,
    isBurger: seed.isBurger ?? false,
    favorite: false,
    ...(proteinSourcesOverride ? { proteinSourcesOverride: [...proteinSourcesOverride] } : {}),
    ...(baseTagsOverride ? { baseTagsOverride: [...baseTagsOverride] } : {}),
  };
}

export class MealCatalogImportService {
  constructor(private readonly deps: MealCatalogImportDependencies) {}

  async importCatalog(identity: Identity, dryRun: boolean): Promise<MealCatalogImportResult> {
    const existing = new Set((await this.deps.dishesOf(identity.tenantId)).map((dish) => nameKey(dish.name)));
    const catalog = this.deps.catalog ?? CATALOG_DISHES;
    const missing = catalog.filter((seed) => !existing.has(nameKey(seed.name)));
    const skipped = catalog.filter((seed) => existing.has(nameKey(seed.name))).map((seed) => seed.name);
    if (!dryRun) {
      for (const seed of missing) await this.deps.createDish(identity, toCreateRequest(seed));
    }
    return { dryRun, dishesCreated: missing.map((seed) => seed.name), dishesSkipped: skipped };
  }
}
