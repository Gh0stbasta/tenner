/** FOOD-014: shopping list — generation, rounding, refresh merge, changes, service with storage and conflicts. */

import { describe, expect, it } from "vitest";
import {
  applyOperations,
  CATALOG_INGREDIENTS_BY_ID,
  createMealServices,
  DEFAULT_HOUSEHOLD_FOOD_RULES,
  foodProfileSchema,
  generateItems,
  mergeRefresh,
  countOf,
  normalizeItem,
  type DishResponse,
  type ResolvedIngredient,
  type ShoppingItem,
  type StoredPlanSlot,
} from "../src/meals/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const ingredients = new Map<string, ResolvedIngredient>(
  [...CATALOG_INGREDIENTS_BY_ID.values()].map((ingredient) => [ingredient.ingredientId, { ...ingredient, source: "CATALOG", overridden: false }]),
);

const dish = (dishId: string, parts: DishResponse["ingredients"]): DishResponse => ({ dishId, ingredients: parts }) as unknown as DishResponse;
const slot = (slotId: string, dishId: string | null, status: StoredPlanSlot["status"] = "PLANNED"): StoredPlanSlot => ({ slotId, dishId, locked: false, source: "AUTO", status });

const profile = {
  eaters: [
    { eaterId: "a1", name: "Erwachsener 1", type: "ADULT" as const, portionFactor: 1, diet: "OMNIVORE" as const, vegetarianExceptions: [], allergies: [], dislikes: [] },
    { eaterId: "a2", name: "Erwachsener 2", type: "ADULT" as const, portionFactor: 1, diet: "OMNIVORE" as const, vegetarianExceptions: [], allergies: [], dislikes: [] },
    { eaterId: "k1", name: "Kind 1", type: "CHILD" as const, portionFactor: 0.5, diet: "OMNIVORE" as const, vegetarianExceptions: [], allergies: [], dislikes: [] },
  ],
  household: DEFAULT_HOUSEHOLD_FOOD_RULES,
} as unknown as Parameters<typeof generateItems>[0]["profile"];

describe("shopping list generation (FOOD-014)", () => {
  const bolognese = dish("bolo", [
    { ingredientId: "pasta", quantity: 125, unit: "g", optional: false },
    { ingredientId: "beef-mince", quantity: 100, unit: "g", optional: false },
    { ingredientId: "olive-oil", quantity: 1, unit: "EL", optional: false },
    { ingredientId: "parmesan", quantity: 1, unit: "EL", optional: true },
  ]);
  const pasta = dish("pasta", [{ ingredientId: "pasta", quantity: 100, unit: "g", optional: false }]);
  const dishes = new Map([bolognese, pasta].map((entry) => [entry.dishId, entry]));

  it("sums quantities × portion factors of the eaters at each meal, rounds up and sorts by section, pantry last", () => {
    const items = generateItems({
      weekStart: "2026-10-12",
      slots: [slot("2026-10-14#LUNCH", "bolo"), slot("2026-10-17#DINNER", "pasta"), slot("2026-10-12#DINNER", "pasta")],
      dishes,
      ingredients,
      profile,
      from: "2026-10-14",
    });
    // Wednesday lunch: adults only (2 portions); Saturday dinner: 2.5 portions; Monday is before „from“.
    const pastaItem = items.find((item) => item.key === "pasta");
    // FOOD-028: counts only — pasta is needed for two meals, mince for one.
    expect(pastaItem).toMatchObject({ quantity: 2, unit: "Stück", usedFor: ["2026-10-14#LUNCH", "2026-10-17#DINNER"], manual: false, checked: false });
    expect(items.find((item) => item.key === "beef-mince")?.quantity).toBe(1);
    expect(items.some((item) => item.key === "parmesan")).toBe(false);
    const oil = items.find((item) => item.key === "olive-oil");
    expect(oil).toMatchObject({ pantry: true, quantity: 1 });
    expect(items.at(-1)?.pantry).toBe(true);
  });

  it("leaves out cooked or skipped meals, empty meals and meals without eaters", () => {
    const items = generateItems({
      weekStart: "2026-10-12",
      slots: [slot("2026-10-14#DINNER", "pasta", "COOKED"), slot("2026-10-15#DINNER", null), slot("2026-10-16#DINNER", "pasta", "SKIPPED")],
      dishes,
      ingredients,
      profile,
      from: "2026-10-12",
    });
    expect(items).toEqual([]);
    expect(generateItems({ weekStart: "2026-10-12", slots: [slot("2026-10-14#DINNER", "pasta")], dishes, ingredients, profile: { ...profile, eaters: [] }, from: "2026-10-12" })).toEqual([]);
  });

  it("counts pieces and meals instead of weights (FOOD-028)", () => {
    expect(countOf(1.2, "Stück", 1)).toBe(2);
    expect(countOf(0.3, "Stück", 3)).toBe(1);
    expect(countOf(450, "g", 2)).toBe(2);
    expect(countOf(1000, "ml", 0)).toBe(1);
  });

  it("shows lists stored with grams as counts", () => {
    const old = { key: "pasta", ingredientId: "pasta", name: "Nudeln", quantity: 500, unit: "g" as const, section: "TROCKENWAREN" as const, pantry: false, checked: true, manual: false, usedFor: ["a", "b", "c"] };
    expect(normalizeItem(old)).toEqual({ ...old, quantity: 3, unit: "Stück" });
    const own = { ...old, key: "manual-1", quantity: null, unit: null, manual: true };
    expect(normalizeItem(own)).toBe(own);
  });
});

const item = (key: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  key,
  ingredientId: key,
  name: key,
  quantity: 100,
  unit: "g",
  section: "TROCKENWAREN",
  pantry: false,
  checked: false,
  manual: false,
  usedFor: [],
  ...overrides,
});

describe("shopping list changes and refresh (FOOD-014)", () => {
  it("ticks, adds, removes and moves items idempotently", () => {
    const start = [item("a"), item("b"), item("c")];
    const ops = [
      { type: "check", key: "b", checked: true },
      { type: "add", key: "manual-1", name: "Klopapier" },
      { type: "add", key: "manual-1", name: "Klopapier" },
      { type: "move", key: "c", afterKey: null },
      { type: "move", key: "a", afterKey: "manual-1" },
      { type: "remove", key: "gone" },
      { type: "move", key: "b", afterKey: "missing" },
    ] as const;
    const once = applyOperations(start, ops);
    expect(once.map((entry) => entry.key)).toEqual(["c", "b", "manual-1", "a"]);
    expect(once.find((entry) => entry.key === "b")?.checked).toBe(true);
    expect(once.find((entry) => entry.key === "manual-1")).toMatchObject({ manual: true, section: "SONSTIGES", quantity: null });
    expect(applyOperations(once, ops).map((entry) => entry.key)).toEqual(["c", "b", "manual-1", "a"]);
    expect(applyOperations(once, [{ type: "remove", key: "manual-1" }]).map((entry) => entry.key)).toEqual(["c", "b", "a"]);
  });

  it("refresh keeps ticks, own items and the own order, updates quantities, drops unused and places new items by section", () => {
    const current = [item("rice", { checked: true }), item("manual-1", { manual: true, ingredientId: null }), item("carrot", { section: "GEMUESE_OBST" }), item("old")];
    const generated = [
      item("carrot", { section: "GEMUESE_OBST", quantity: 300 }),
      item("apple", { section: "GEMUESE_OBST" }),
      item("rice", { quantity: 250 }),
      item("salt", { section: "GEWUERZE", pantry: true }),
    ];
    const merged = mergeRefresh(current, generated);
    expect(merged.map((entry) => entry.key)).toEqual(["rice", "manual-1", "carrot", "apple", "salt"]);
    expect(merged[0]).toMatchObject({ checked: true, quantity: 250 });
    expect(merged.find((entry) => entry.key === "carrot")?.quantity).toBe(300);
  });
});

/** Wednesday 2026-10-14, 10:00 in Berlin. */
const NOW = new Date("2026-10-14T08:00:00Z");

async function ready() {
  const meals = inMemoryMeals();
  let next = 0;
  const services = createMealServices({
    client: meals.sender,
    tableName: "tenner-meals",
    membersOf: async () => SEED_MEMBERS,
    settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn: "MONDAY" }),
    clock: () => NOW,
    ids: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  });
  await services.catalog.importCatalog(TEST_IDENTITY, false);
  await services.profiles.updateProfile(
    TEST_IDENTITY,
    validate(foodProfileSchema, {
      eaters: [
        { eaterId: "a1", name: "Erwachsener 1", type: "ADULT" },
        { eaterId: "k1", name: "Kind 1", type: "CHILD" },
      ],
      household: DEFAULT_HOUSEHOLD_FOOD_RULES,
    }),
  );
  return { meals, services };
}

describe("ShoppingListService (FOOD-014)", () => {
  it("needs a plan, then makes the list once from today on", async () => {
    const { services, meals } = await ready();
    await expect(services.shopping.getList("default", "current")).rejects.toMatchObject({ statusCode: 404 });
    const plan = await services.plans.getPlan("default", "current");
    const list = await services.shopping.getList("default", "current");
    expect(list).toMatchObject({ weekStart: "2026-10-12", range: "REST", stale: false });
    expect(list.items.length).toBeGreaterThan(5);
    const usedFor = new Set(list.items.flatMap((entry) => entry.usedFor));
    expect([...usedFor].every((slotId) => slotId >= "2026-10-14")).toBe(true);
    expect(plan.slots.length).toBe(14);
    expect(await services.shopping.getList("default", "current")).toEqual(list);
    expect(meals.items.get("default|LIST#2026-10-12")?.version).toBe(1);
  });

  it("marks the list stale after a plan change and refreshes it, keeping ticks and own items", async () => {
    const { services } = await ready();
    await services.plans.getPlan("default", "current");
    const list = await services.shopping.getList("default", "current");
    const first = list.items[0] as ShoppingItem;
    await services.shopping.changeList(TEST_IDENTITY, "current", [
      { type: "check", key: first.key, checked: true },
      { type: "add", key: "manual-x", name: "Klopapier" },
    ]);
    await services.plans.regenerateWeek(TEST_IDENTITY, "current");
    const stale = await services.shopping.getList("default", "current");
    expect(stale.stale).toBe(true);
    const refreshed = await services.shopping.refreshList(TEST_IDENTITY, "current", "WEEK");
    expect(refreshed).toMatchObject({ stale: false, range: "WEEK" });
    expect(refreshed.items.some((entry) => entry.key === "manual-x")).toBe(true);
    const kept = refreshed.items.find((entry) => entry.key === first.key);
    if (kept) expect(kept.checked).toBe(true);
    expect(refreshed.items.some((entry) => entry.usedFor.some((slotId) => slotId < "2026-10-14"))).toBe(true);
  });

  it("shows a list stored with grams as counts without marking it outdated (FOOD-028)", async () => {
    const { services, meals } = await ready();
    await services.plans.getPlan("default", "current");
    const list = await services.shopping.getList("default", "current");
    const stored = meals.items.get("default|LIST#2026-10-12") as { items: ShoppingItem[]; signature: string };
    // Before FOOD-028 weighed ingredients were stored in grams; pieces were already counts.
    const weighed = (entry: ShoppingItem) => CATALOG_INGREDIENTS_BY_ID.get(entry.ingredientId ?? "")?.unit !== "Stück";
    stored.items = stored.items.map((entry) => (weighed(entry) ? { ...entry, quantity: 500, unit: "g" } : entry));
    stored.signature = "before FOOD-028";
    const shown = await services.shopping.getList("default", "current");
    expect(shown.stale).toBe(false);
    expect(shown.items.every((entry) => entry.unit === "Stück")).toBe(true);
    expect(shown.items.filter(weighed).every((entry) => entry.quantity === Math.max(1, entry.usedFor.length))).toBe(true);
    expect(shown.items.map((entry) => entry.key)).toEqual(list.items.map((entry) => entry.key));
  });

  it("merges a parallel change from the other phone instead of failing", async () => {
    const { services, meals } = await ready();
    await services.plans.getPlan("default", "current");
    const list = await services.shopping.getList("default", "current");
    const [a, b] = list.items as [ShoppingItem, ShoppingItem];
    const original = meals.sender.send.bind(meals.sender);
    let interfered = false;
    meals.sender.send = async (command) => {
      if (!interfered && command.constructor.name === "PutCommand") {
        interfered = true;
        meals.sender.send = original;
        await services.shopping.changeList(TEST_IDENTITY, "current", [{ type: "check", key: b.key, checked: true }]);
      }
      return original(command);
    };
    const changed = await services.shopping.changeList(TEST_IDENTITY, "current", [{ type: "check", key: a.key, checked: true }]);
    expect(changed.items.filter((entry) => entry.checked).map((entry) => entry.key).sort()).toEqual([a.key, b.key].sort());
  });
});
