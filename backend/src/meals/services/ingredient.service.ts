/**
 * Ingredients (FOOD-021): catalog ingredients from code, merged with the household's own ingredients and its changes
 * to catalog values (both stored as INGREDIENT#<id>; kind CUSTOM or OVERRIDE).
 */

import type { Identity } from "../../auth/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../../exceptions/index.js";
import { toUtcTimestamp, type Clock } from "../../utils/clock.js";
import { CATALOG_INGREDIENTS, CATALOG_INGREDIENTS_BY_ID } from "../catalog/ingredients.js";
import { idOfItemKey, itemKey, itemKeyPrefix } from "../keys.js";
import {
  BASE_TAGS,
  INGREDIENT_TAGS,
  INGREDIENT_UNITS,
  PROTEIN_TAGS,
  SHOPPING_SECTIONS,
  customIngredientId,
  type Ingredient,
  type Nutrition,
  type ResolvedIngredient,
} from "../models/ingredient.js";
import type { MealItem, MealItemData, MealsStore } from "../repositories/meals-store.js";
import type { CreateIngredientRequest, UpdateIngredientRequest } from "../validators.js";

type StoredKind = "CUSTOM" | "OVERRIDE";

const nameKey = (name: string): string => name.trim().toLocaleLowerCase("de");
const byName = (a: ResolvedIngredient, b: ResolvedIngredient): number => a.name.localeCompare(b.name, "de");

function isNutrition(value: unknown): value is Nutrition {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ["kcal", "protein", "carbs", "fat"].every((field) => typeof record[field] === "number");
}

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | undefined => ((values as readonly unknown[]).includes(value) ? (value as T) : undefined);

/** Stored fields that may change an ingredient; malformed values are ignored. */
function storedChanges(data: MealItemData): Partial<Ingredient> {
  const tags = Array.isArray(data.tags) ? data.tags.flatMap((tag) => oneOf(INGREDIENT_TAGS, tag) ?? []) : undefined;
  const changes: Record<string, unknown> = {
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    ...(tags ? { tags } : {}),
    ...(oneOf(SHOPPING_SECTIONS, data.shoppingSection) ? { shoppingSection: data.shoppingSection } : {}),
    ...(isNutrition(data.nutritionPer100g) ? { nutritionPer100g: data.nutritionPer100g } : {}),
    ...(typeof data.pricePerUnit === "number" ? { pricePerUnit: data.pricePerUnit } : {}),
    ...(typeof data.pantry === "boolean" ? { pantry: data.pantry } : {}),
    ...(typeof data.gramsPerPiece === "number" ? { gramsPerPiece: data.gramsPerPiece } : {}),
  };
  if ("proteinTag" in data) changes.proteinTag = oneOf(PROTEIN_TAGS, data.proteinTag);
  if ("baseTag" in data) changes.baseTag = oneOf(BASE_TAGS, data.baseTag);
  return changes as Partial<Ingredient>;
}

/** Drop optional tags that were cleared (undefined), so the response has no undefined fields. */
function compact(ingredient: ResolvedIngredient): ResolvedIngredient {
  return Object.fromEntries(Object.entries(ingredient).filter(([, value]) => value !== undefined)) as unknown as ResolvedIngredient;
}

function resolveStored(id: string, item: MealItem): ResolvedIngredient | undefined {
  const kind = item.data.kind as StoredKind | undefined;
  const changes = storedChanges(item.data);
  const catalog = CATALOG_INGREDIENTS_BY_ID.get(id);
  if (kind === "OVERRIDE" && catalog) return compact({ ...catalog, ...changes, ingredientId: id, unit: catalog.unit, source: "CATALOG", overridden: true });
  const unit = oneOf(INGREDIENT_UNITS, item.data.unit);
  if (kind !== "CUSTOM" || !unit || changes.name === undefined || changes.shoppingSection === undefined || changes.nutritionPer100g === undefined) return undefined;
  return compact({
    tags: [],
    pricePerUnit: 0,
    pantry: false,
    ...changes,
    name: changes.name,
    shoppingSection: changes.shoppingSection,
    nutritionPer100g: changes.nutritionPer100g,
    ingredientId: id,
    unit,
    source: "CUSTOM",
    overridden: false,
  });
}

/** Fields of a request without undefined values; null clears protein and base tags. */
function requestData(request: Partial<CreateIngredientRequest> | UpdateIngredientRequest): MealItemData {
  return Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined));
}

export class IngredientService {
  constructor(
    private readonly store: MealsStore,
    private readonly clock: Clock,
  ) {}

  /** All ingredients of the household, sorted by name. */
  async listIngredients(tenantId: string): Promise<ResolvedIngredient[]> {
    return [...(await this.ingredientsOf(tenantId)).values()].sort(byName);
  }

  /** Ingredients by ID (catalog with household changes, plus the household's own). */
  async ingredientsOf(tenantId: string): Promise<Map<string, ResolvedIngredient>> {
    const stored = await this.store.query(tenantId, itemKeyPrefix("INGREDIENT"));
    const resolved = new Map<string, ResolvedIngredient>(CATALOG_INGREDIENTS.map((entry) => [entry.ingredientId, { ...entry, source: "CATALOG", overridden: false }]));
    for (const item of stored) {
      const id = idOfItemKey("INGREDIENT", item.itemKey);
      const ingredient = id === undefined ? undefined : resolveStored(id, item);
      if (id !== undefined && ingredient) resolved.set(id, ingredient);
    }
    return resolved;
  }

  async createIngredient(identity: Identity, request: CreateIngredientRequest): Promise<ResolvedIngredient> {
    const existing = await this.ingredientsOf(identity.tenantId);
    this.assertNameFree(existing, request.name);
    const baseId = customIngredientId(request.name);
    let ingredientId = baseId;
    for (let suffix = 2; existing.has(ingredientId); suffix += 1) ingredientId = `${baseId}-${suffix}`;
    const timestamp = toUtcTimestamp(this.clock());
    const item = await this.store.put(identity.tenantId, itemKey("INGREDIENT", ingredientId), {
      ...requestData(request),
      name: request.name.trim(),
      kind: "CUSTOM",
      createdAt: timestamp,
      createdBy: identity.userId,
      updatedAt: timestamp,
      updatedBy: identity.userId,
    });
    return this.resolved(ingredientId, item);
  }

  /** Change a household ingredient, or store changes to a catalog ingredient (the catalog unit stays fixed). */
  async updateIngredient(identity: Identity, ingredientId: string, request: UpdateIngredientRequest): Promise<ResolvedIngredient> {
    const existing = await this.ingredientsOf(identity.tenantId);
    const current = existing.get(ingredientId);
    if (!current) throw new NotFoundError("Ingredient not found.");
    if (request.name !== undefined && nameKey(request.name) !== nameKey(current.name)) this.assertNameFree(existing, request.name);
    if (request.gramsPerPiece !== undefined && current.unit !== "Stück") throw new ValidationError("Validation failed.", [{ field: "gramsPerPiece", message: "Only pieces have a weight per piece." }]);
    const key = itemKey("INGREDIENT", ingredientId);
    const stored = await this.store.get(identity.tenantId, key);
    const kind: StoredKind = current.source === "CUSTOM" ? "CUSTOM" : "OVERRIDE";
    const timestamp = toUtcTimestamp(this.clock());
    const data: MealItemData = {
      ...(stored?.data ?? {}),
      ...requestData(request),
      ...(request.name === undefined ? {} : { name: request.name.trim() }),
      kind,
      updatedAt: timestamp,
      updatedBy: identity.userId,
    };
    const item = await this.store.put(identity.tenantId, key, data, stored?.version);
    return this.resolved(ingredientId, item);
  }

  private resolved(ingredientId: string, item: MealItem): ResolvedIngredient {
    const ingredient = resolveStored(ingredientId, item);
    if (!ingredient) throw new ValidationError("Validation failed.", [{ field: "(root)", message: "Incomplete ingredient." }]);
    return ingredient;
  }

  private assertNameFree(existing: ReadonlyMap<string, ResolvedIngredient>, name: string): void {
    const key = nameKey(name);
    if ([...existing.values()].some((ingredient) => nameKey(ingredient.name) === key)) {
      throw new ConflictError("An ingredient with this name already exists.", "INGREDIENT_NAME_TAKEN");
    }
  }
}
