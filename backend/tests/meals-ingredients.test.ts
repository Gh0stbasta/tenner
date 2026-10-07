/** FOOD-021: ingredient catalog, household ingredients and catalog overrides. */

import { describe, expect, it } from "vitest";
import {
  BASE_TAGS,
  CATALOG_INGREDIENTS,
  CATALOG_INGREDIENTS_BY_ID,
  createIngredientSchema,
  customIngredientId,
  IngredientService,
  PROTEIN_TAGS,
  toBaseQuantity,
  toGrams,
  updateIngredientSchema,
} from "../src/meals/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T10:00:00Z");

function service() {
  const meals = inMemoryMeals();
  return { meals, service: new IngredientService(meals.store, () => NOW) };
}

const create = (body: unknown) => validate(createIngredientSchema, body);
const update = (body: unknown) => validate(updateIngredientSchema, body);

describe("ingredient catalog", () => {
  it("has unique IDs and names", () => {
    expect(new Set(CATALOG_INGREDIENTS.map((entry) => entry.ingredientId)).size).toBe(CATALOG_INGREDIENTS.length);
    expect(new Set(CATALOG_INGREDIENTS.map((entry) => entry.name.toLowerCase())).size).toBe(CATALOG_INGREDIENTS.length);
  });

  it("is complete: valid IDs, piece weights, non-negative values, prices for non-pantry items", () => {
    for (const entry of CATALOG_INGREDIENTS) {
      expect(entry.ingredientId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.unit !== "Stück" || (entry.gramsPerPiece ?? 0) > 0, entry.ingredientId).toBe(true);
      expect(Object.values(entry.nutritionPer100g).every((value) => value >= 0), entry.ingredientId).toBe(true);
      expect(entry.pantry || entry.pricePerUnit > 0, entry.ingredientId).toBe(true);
      expect(entry.pantry || entry.nutritionPer100g.kcal > 0, entry.ingredientId).toBe(true);
    }
  });

  it("tags allergens and protein sources the household rules need", () => {
    const tagged = (id: string) => CATALOG_INGREDIENTS_BY_ID.get(id);
    expect(tagged("apple")?.tags).toContain("APPLE");
    expect(tagged("applesauce")?.tags).toContain("APPLE");
    expect(tagged("coconut-milk")?.tags).toContain("COCONUT");
    expect(tagged("chicken-breast")?.proteinTag).toBe("POULTRY");
    expect(tagged("chicken-nuggets-frozen")?.proteinTag).toBe("POULTRY");
    expect(tagged("salmon")?.proteinTag).toBe("FISH");
    expect(tagged("fish-fingers-frozen")?.proteinTag).toBe("FISH");
    expect(tagged("beef-mince")?.proteinTag).toBe("MINCE");
    expect(tagged("burger-patty")?.proteinTag).toBe("BURGER_PATTY");
    expect(tagged("sausage")?.proteinTag).toBe("SAUSAGE");
    expect(tagged("meatballs-frozen")?.proteinTag).toBe("MEATBALL");
    expect(tagged("egg")?.proteinTag).toBeUndefined();
    expect(tagged("halloumi")?.proteinTag).toBeUndefined();
    expect(tagged("spaetzle")?.baseTag).toBe("PASTA");
    expect(tagged("gnocchi")?.baseTag).toBe("GNOCCHI");
    expect(tagged("schupfnudeln")?.baseTag).toBe("SCHUPFNUDELN");
    expect(CATALOG_INGREDIENTS.some((entry) => entry.tags.includes("NUTS"))).toBe(false);
  });

  it("only uses known protein and base tags", () => {
    for (const entry of CATALOG_INGREDIENTS) {
      if (entry.proteinTag) expect(PROTEIN_TAGS).toContain(entry.proteinTag);
      if (entry.baseTag) expect(BASE_TAGS).toContain(entry.baseTag);
    }
  });
});

describe("unit conversion", () => {
  const gramIngredient = { unit: "g" as const };
  const piece = { unit: "Stück" as const, gramsPerPiece: 60 };

  it("keeps the base unit and converts spoons for g and ml", () => {
    expect(toBaseQuantity(200, "g", gramIngredient)).toBe(200);
    expect(toBaseQuantity(2, "EL", gramIngredient)).toBe(30);
    expect(toBaseQuantity(1, "TL", { unit: "ml" })).toBe(5);
  });

  it("refuses conversions between incompatible units", () => {
    expect(toBaseQuantity(1, "EL", piece)).toBeUndefined();
    expect(toBaseQuantity(1, "Stück", gramIngredient)).toBeUndefined();
    expect(toGrams(1, "g", piece)).toBeUndefined();
  });

  it("converts pieces to grams by their weight", () => {
    expect(toGrams(2, "Stück", piece)).toBe(120);
    expect(toGrams(2, "Stück", { unit: "Stück" })).toBeUndefined();
    expect(toGrams(100, "ml", { unit: "ml" })).toBe(100);
  });

  it("builds slugs for household ingredients", () => {
    expect(customIngredientId("Rote Bete")).toBe("custom-rote-bete");
    expect(customIngredientId("Süßkartoffel")).toBe("custom-suesskartoffel");
    expect(customIngredientId("!!!")).toBe("custom-zutat");
  });
});

describe("IngredientService", () => {
  it("lists the catalog sorted by name", async () => {
    const { service: ingredients } = service();
    const list = await ingredients.listIngredients("default");
    expect(list).toHaveLength(CATALOG_INGREDIENTS.length);
    expect(list.every((entry) => entry.source === "CATALOG" && !entry.overridden)).toBe(true);
    expect(list.map((entry) => entry.name)).toEqual([...list.map((entry) => entry.name)].sort((a, b) => a.localeCompare(b, "de")));
  });

  it("creates a household ingredient with defaults", async () => {
    const { service: ingredients } = service();
    const created = await ingredients.createIngredient(TEST_IDENTITY, create({ name: " Rote Bete ", unit: "g", shoppingSection: "GEMUESE_OBST" }));
    expect(created).toMatchObject({ ingredientId: "custom-rote-bete", name: "Rote Bete", unit: "g", tags: [], pricePerUnit: 0, pantry: false, source: "CUSTOM" });
    expect((await ingredients.listIngredients("default")).some((entry) => entry.ingredientId === "custom-rote-bete")).toBe(true);
    expect((await ingredients.listIngredients("other")).some((entry) => entry.ingredientId === "custom-rote-bete")).toBe(false);
  });

  it("rejects duplicate names (catalog and household, case-insensitive)", async () => {
    const { service: ingredients } = service();
    await expect(ingredients.createIngredient(TEST_IDENTITY, create({ name: "tomaten", unit: "g" }))).rejects.toMatchObject({ code: "INGREDIENT_NAME_TAKEN" });
    await ingredients.createIngredient(TEST_IDENTITY, create({ name: "Tofu", unit: "g", tags: ["TOFU", "SOY"] }));
    await expect(ingredients.createIngredient(TEST_IDENTITY, create({ name: "TOFU", unit: "g" }))).rejects.toMatchObject({ statusCode: 409 });
  });

  it("gives colliding slugs a suffix", async () => {
    const { service: ingredients } = service();
    await ingredients.createIngredient(TEST_IDENTITY, create({ name: "Rote-Bete", unit: "g" }));
    const second = await ingredients.createIngredient(TEST_IDENTITY, create({ name: "Rote Bete!", unit: "g" }));
    expect(second.ingredientId).toBe("custom-rote-bete-2");
  });

  it("stores changes to catalog ingredients and keeps their unit", async () => {
    const { service: ingredients } = service();
    const changed = await ingredients.updateIngredient(TEST_IDENTITY, "salmon", update({ pricePerUnit: 3.2 }));
    expect(changed).toMatchObject({ ingredientId: "salmon", unit: "g", pricePerUnit: 3.2, proteinTag: "FISH", source: "CATALOG", overridden: true });
    const again = await ingredients.updateIngredient(TEST_IDENTITY, "salmon", update({ name: "Lachs", proteinTag: null }));
    expect(again.pricePerUnit).toBe(3.2);
    expect(again.name).toBe("Lachs");
    expect(again).not.toHaveProperty("proteinTag");
  });

  it("updates household ingredients and checks names and piece weights", async () => {
    const { service: ingredients } = service();
    await ingredients.createIngredient(TEST_IDENTITY, create({ name: "Rote Bete", unit: "g" }));
    await expect(ingredients.updateIngredient(TEST_IDENTITY, "custom-rote-bete", update({ name: "Zwiebeln" }))).rejects.toMatchObject({ code: "INGREDIENT_NAME_TAKEN" });
    await expect(ingredients.updateIngredient(TEST_IDENTITY, "custom-rote-bete", update({ gramsPerPiece: 50 }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(ingredients.updateIngredient(TEST_IDENTITY, "custom-rote-bete", update({ name: "rote bete", baseTag: "POTATO" }))).resolves.toMatchObject({ name: "rote bete", baseTag: "POTATO" });
  });

  it("answers 404 for unknown ingredients", async () => {
    const { service: ingredients } = service();
    await expect(ingredients.updateIngredient(TEST_IDENTITY, "dragonfruit", update({ pantry: true }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("ignores malformed stored items", async () => {
    const { meals, service: ingredients } = service();
    meals.items.set("default|INGREDIENT#custom-broken", { tenantId: "default", itemKey: "INGREDIENT#custom-broken", version: 1, kind: "CUSTOM", name: "Kaputt" });
    meals.items.set("default|INGREDIENT#salmon", { tenantId: "default", itemKey: "INGREDIENT#salmon", version: 1, kind: "OVERRIDE", pricePerUnit: "teuer", tags: ["NUTS", "UNKNOWN"] });
    const list = await ingredients.ingredientsOf("default");
    expect(list.has("custom-broken")).toBe(false);
    expect(list.get("salmon")).toMatchObject({ pricePerUnit: 2.5, tags: ["NUTS"], overridden: true });
  });
});

describe("ingredient request validation", () => {
  it("requires a piece weight for pieces and rejects unknown fields", () => {
    expect(() => create({ name: "Brötchen", unit: "Stück" })).toThrow();
    expect(create({ name: "Brötchen", unit: "Stück", gramsPerPiece: 60 }).gramsPerPiece).toBe(60);
    expect(() => create({ name: "X", unit: "g" })).toThrow();
    expect(() => create({ name: "Salz2", unit: "kg" })).toThrow();
    expect(() => update({ unit: "g" })).toThrow();
    expect(() => update({})).toThrow();
    expect(() => update({ tags: ["NUTS", "NUTS"] })).toThrow();
  });
});
