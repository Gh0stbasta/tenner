/** FOOD-002: dish model, derived values, validation and the dish service. */

import { describe, expect, it } from "vitest";
import { createDishSchema, deriveDish, DishService, IngredientService, updateDishSchema, type CreateDishRequest } from "../src/meals/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T10:00:00Z");

function setup() {
  const meals = inMemoryMeals();
  const ingredients = new IngredientService(meals.store, () => NOW);
  let next = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const dishes = new DishService(meals.store, (tenantId) => ingredients.ingredientsOf(tenantId), () => NOW, ids);
  return { meals, ingredients, dishes };
}

const create = (body: Record<string, unknown>): CreateDishRequest =>
  validate(createDishSchema, { category: "PASTA", slots: ["DINNER"], lightness: "FILLING", temperature: "WARM", activeMinutes: 15, ...body });

const bolognese = () =>
  create({
    name: "Spaghetti Bolognese",
    ingredients: [
      { ingredientId: "pasta", quantity: 125, unit: "g" },
      { ingredientId: "beef-mince", quantity: 100, unit: "g" },
      { ingredientId: "passata", quantity: 150, unit: "g" },
      { ingredientId: "parmesan", quantity: 1, unit: "EL", optional: true },
    ],
    totalMinutes: 30,
  });

describe("deriveDish", () => {
  it("derives diet, tags, protein and base from required ingredients", async () => {
    const { ingredients } = setup();
    const derived = deriveDish(bolognese(), await ingredients.ingredientsOf("default"));
    expect(derived).toMatchObject({ isVegetarian: false, proteinSources: ["MINCE"], baseTags: ["PASTA"], containsPoultry: false, unknownIngredients: [] });
    expect(derived.tags).toEqual(expect.arrayContaining(["GLUTEN", "MEAT", "BEEF"]));
    expect(derived.optionalTags).toEqual(["MILK"]);
  });

  it("ignores optional ingredients for diet and allergies, and lets overrides win", async () => {
    const { ingredients } = setup();
    const map = await ingredients.ingredientsOf("default");
    const puffer = create({
      name: "Kartoffelpuffer",
      category: "POTATO",
      ingredients: [
        { ingredientId: "potato-pancake-frozen", quantity: 250, unit: "g" },
        { ingredientId: "applesauce", quantity: 100, unit: "g", optional: true },
      ],
    });
    expect(deriveDish(puffer, map)).toMatchObject({ isVegetarian: true, tags: [], optionalTags: ["APPLE"], baseTags: ["POTATO"] });
    const frikadellen = { ...create({ name: "Frikadellen", ingredients: [{ ingredientId: "mixed-mince", quantity: 120, unit: "g" }] }), proteinSourcesOverride: ["MEATBALL" as const] };
    expect(deriveDish(frikadellen, map).proteinSources).toEqual(["MEATBALL"]);
  });

  it("flags poultry and unknown ingredients", async () => {
    const { ingredients } = setup();
    const map = await ingredients.ingredientsOf("default");
    const dinos = create({ name: "Chicken Dinos", ingredients: [{ ingredientId: "chicken-nuggets-frozen", quantity: 150, unit: "g" }, { ingredientId: "gone", quantity: 1, unit: "g" }] });
    expect(deriveDish(dinos, map)).toMatchObject({ containsPoultry: true, isVegetarian: false, unknownIngredients: ["gone"] });
  });
});

describe("dish request validation", () => {
  it("applies defaults and checks ranges", () => {
    const request = bolognese();
    expect(request).toMatchObject({ familyFriendly: true, isBurger: false, favorite: false });
    expect(request.ingredients[0]?.optional).toBe(false);
    expect(() => create({ name: "X", ingredients: [{ ingredientId: "pasta", quantity: 1, unit: "g" }] })).toThrow();
    expect(() => create({ name: "Nudeln", ingredients: [] })).toThrow();
    expect(() => create({ name: "Nudeln", slots: [], ingredients: [{ ingredientId: "pasta", quantity: 1, unit: "g" }] })).toThrow();
    expect(() => create({ name: "Nudeln", activeMinutes: 241, ingredients: [{ ingredientId: "pasta", quantity: 1, unit: "g" }] })).toThrow();
    expect(() => create({ name: "Nudeln", activeMinutes: 20, totalMinutes: 10, ingredients: [{ ingredientId: "pasta", quantity: 1, unit: "g" }] })).toThrow();
    expect(() =>
      create({
        name: "Nudeln",
        ingredients: [
          { ingredientId: "pasta", quantity: 1, unit: "g" },
          { ingredientId: "pasta", quantity: 2, unit: "g" },
        ],
      }),
    ).toThrow();
    expect(() => validate(updateDishSchema, { activeMinutes: 30, totalMinutes: 20 })).toThrow();
    expect(() => validate(updateDishSchema, { imageKey: "x" })).toThrow();
  });
});

describe("DishService", () => {
  it("creates a dish with derived values and total time defaulting to active time", async () => {
    const { dishes } = setup();
    const dish = await dishes.createDish(TEST_IDENTITY, create({ name: " Onigiri ", category: "VEGETARIAN", slots: ["LUNCH"], ingredients: [{ ingredientId: "sushi-rice", quantity: 80, unit: "g" }] }));
    expect(dish).toMatchObject({ name: "Onigiri", totalMinutes: 15, archived: false, isVegetarian: true, baseTags: ["RICE"], createdAt: "2026-10-07T10:00:00Z" });
    expect(dish).not.toHaveProperty("group");
    await expect(dishes.getDish("default", dish.dishId)).resolves.toMatchObject({ name: "Onigiri" });
    await expect(dishes.getDish("other", dish.dishId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects unknown ingredients and units that do not fit", async () => {
    const { dishes } = setup();
    await expect(dishes.createDish(TEST_IDENTITY, create({ name: "Rätsel", ingredients: [{ ingredientId: "unicorn", quantity: 1, unit: "g" }] }))).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: "ingredients.0.ingredientId", message: "Unknown ingredient." }],
    });
    await expect(dishes.createDish(TEST_IDENTITY, create({ name: "Eier", ingredients: [{ ingredientId: "egg", quantity: 2, unit: "EL" }] }))).rejects.toMatchObject({
      details: [{ field: "ingredients.0.unit" }],
    });
  });

  it("keeps names unique among active dishes", async () => {
    const { dishes } = setup();
    const first = await dishes.createDish(TEST_IDENTITY, bolognese());
    await expect(dishes.createDish(TEST_IDENTITY, { ...bolognese(), name: "spaghetti bolognese" })).rejects.toMatchObject({ code: "DISH_NAME_TAKEN" });
    await dishes.archiveDish(TEST_IDENTITY, first.dishId);
    const second = await dishes.createDish(TEST_IDENTITY, bolognese());
    await expect(dishes.restoreDish(TEST_IDENTITY, first.dishId)).rejects.toMatchObject({ code: "DISH_NAME_TAKEN" });
    await dishes.updateDish(TEST_IDENTITY, second.dishId, validate(updateDishSchema, { name: "Spaghetti Bolo" }));
    await expect(dishes.restoreDish(TEST_IDENTITY, first.dishId)).resolves.toMatchObject({ archived: false });
  });

  it("lists active dishes by default, sorted, with slot and archive filters", async () => {
    const { dishes } = setup();
    const lunch = await dishes.createDish(TEST_IDENTITY, create({ name: "Onigiri", slots: ["LUNCH"], ingredients: [{ ingredientId: "sushi-rice", quantity: 80, unit: "g" }] }));
    await dishes.createDish(TEST_IDENTITY, bolognese());
    await dishes.createDish(TEST_IDENTITY, create({ name: "Chili", slots: ["LUNCH", "DINNER"], ingredients: [{ ingredientId: "kidney-beans", quantity: 100, unit: "g" }] }));
    expect((await dishes.listDishes("default")).map((dish) => dish.name)).toEqual(["Chili", "Onigiri", "Spaghetti Bolognese"]);
    expect((await dishes.listDishes("default", { slot: "LUNCH" })).map((dish) => dish.name)).toEqual(["Chili", "Onigiri"]);
    await dishes.archiveDish(TEST_IDENTITY, lunch.dishId);
    expect((await dishes.listDishes("default", { archived: true })).map((dish) => dish.name)).toEqual(["Onigiri"]);
    expect(await dishes.listDishes("other")).toEqual([]);
  });

  it("updates fields, clears optional ones with null and checks times", async () => {
    const { dishes } = setup();
    const dish = await dishes.createDish(TEST_IDENTITY, { ...bolognese(), group: "Bolognese", vegetarianVariant: "mit Linsen" });
    const updated = await dishes.updateDish(TEST_IDENTITY, dish.dishId, validate(updateDishSchema, { group: null, vegetarianVariant: null, favorite: true, proteinSourcesOverride: ["MEATBALL"] }));
    expect(updated).toMatchObject({ favorite: true, proteinSources: ["MEATBALL"] });
    expect(updated).not.toHaveProperty("group");
    expect(updated).not.toHaveProperty("vegetarianVariant");
    await expect(dishes.updateDish(TEST_IDENTITY, dish.dishId, validate(updateDishSchema, { activeMinutes: 40 }))).rejects.toMatchObject({ details: [{ field: "totalMinutes" }] });
    await expect(dishes.updateDish(TEST_IDENTITY, dish.dishId, validate(updateDishSchema, { ingredients: [{ ingredientId: "unicorn", quantity: 1, unit: "g" }] }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(dishes.updateDish(TEST_IDENTITY, "00000000-0000-4000-8000-999999999999", validate(updateDishSchema, { favorite: true }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("archives idempotently and reflects ingredient changes in derived values", async () => {
    const { dishes, ingredients } = setup();
    const dish = await dishes.createDish(TEST_IDENTITY, bolognese());
    await dishes.archiveDish(TEST_IDENTITY, dish.dishId);
    await expect(dishes.archiveDish(TEST_IDENTITY, dish.dishId)).resolves.toMatchObject({ archived: true });
    await ingredients.updateIngredient(TEST_IDENTITY, "beef-mince", { proteinTag: "MEATBALL" });
    await expect(dishes.getDish("default", dish.dishId)).resolves.toMatchObject({ proteinSources: ["MEATBALL"] });
  });

  it("reports concurrent changes as 409", async () => {
    const { dishes, meals } = setup();
    const dish = await dishes.createDish(TEST_IDENTITY, bolognese());
    const key = `default|DISH#${dish.dishId}`;
    const original = meals.sender.send.bind(meals.sender);
    let bumped = false;
    meals.sender.send = async (command) => {
      if (!bumped && command.constructor.name === "PutCommand") {
        bumped = true;
        const stored = meals.items.get(key);
        if (stored) meals.items.set(key, { ...stored, version: Number(stored.version) + 1 });
      }
      return original(command);
    };
    await expect(dishes.updateDish(TEST_IDENTITY, dish.dishId, validate(updateDishSchema, { favorite: true }))).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
});
