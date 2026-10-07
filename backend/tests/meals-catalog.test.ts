/** FOOD-003: family dish catalog, its classification and the idempotent import; review sheet in sync. */

import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOG_DISHES,
  createDishSchema,
  deriveDish,
  DishService,
  IngredientService,
  MealCatalogImportService,
  type ResolvedIngredient,
  type SeedDish,
} from "../src/meals/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T10:00:00Z");
const REVIEW_SHEET = new URL("../../docs/release-2.0/food-catalog-review.md", import.meta.url);

/** The owner's lists (EPIC-FOOD-001): 57 dishes, „Salat mit Protein“ as variants. */
const OWNER_DISHES = [
  "Nudeln mit Soße", "Spaghetti Bolognese", "One Pot Pasta", "Käsemakkaroni", "Ofenrigatoni", "Tortellini", "Tortellini mit Frischkäsefüllung & Brokkoli", "Ravioli", "Lasagne", "Nudelauflauf",
  "Kartoffelsuppe mit Würstl", "Kartoffeln mit Butter", "Kartoffelpuffer", "Kartoffelmuffins", "Bratkartoffeln mit Ei", "Bratkartoffeln mit Würstl", "Frikadellen mit Kartoffelbrei", "Fischstäbchen-Auflauf mit Kartoffeln und Spinat", "Rösti mit Kräuterquark", "Eier in Senfsoße mit Kartoffeln",
  "Gnocchi in Tomatensoße", "Gnocchi in Spinatsoße", "Gnocchi mit Spinat & Feta",
  "Eierreis mit Gemüse", "Mikrowellenrisotto", "Chili", "Reispfanne mit Paprika & Zucchini", "Curryreis mit Kokosmilch (mild)",
  "Burger", "Burgerwraps", "Piratenburger", "Gemüsefrikadellen", "Hot Dogs",
  "Spätzle mit Hackbraten", "Spätzle mit Soße", "Köttbullar", "Chicken Dinos mit Pommes", "Fischstäbchen mit Erbsenpüree", "Gebratener Lachs mit Gemüse",
  "Spätzle", "Käsespätzle mit Röstzwiebeln", "Schupfnudeln", "Grießbrei", "Kaiserschmarrn", "Ofengemüse mit Kräuterquark", "Gebratener Halloumi mit Ofengemüse", "Gemüsecurry", "Linseneintopf", "Ramen", "Onigiri", "Toast Hawaii", "Flammkuchen", "Pfannenpizza (Wrap-Boden)", "Mozzarella-Tomaten-Baguettes", "Kontaktgrill-Sandwiches", "Gemüse-Toasts aus dem Ofen",
];
const SALAD_VARIANTS = ["Salat mit Halloumi", "Salat mit Ei", "Salat mit Feta", "Salat mit Lachs", "Salat mit Hähnchen"];

/** Protein forms the owner's vegetarian adult eats (EPIC-FOOD-001). */
const VEGETARIAN_EXCEPTIONS = ["MINCE", "SAUSAGE"];

function setup() {
  const meals = inMemoryMeals();
  const ingredients = new IngredientService(meals.store, () => NOW);
  let next = 0;
  const dishes = new DishService(meals.store, (tenantId) => ingredients.ingredientsOf(tenantId), () => NOW, () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`);
  const importer = new MealCatalogImportService({ dishesOf: (tenantId) => dishes.dishesOf(tenantId), createDish: (identity, request) => dishes.createDish(identity, request) });
  return { meals, ingredients, dishes, importer };
}

async function catalogIngredients(): Promise<ReadonlyMap<string, ResolvedIngredient>> {
  return setup().ingredients.ingredientsOf("default");
}

const derived = async (seed: SeedDish) => deriveDish(seed, await catalogIngredients());

describe("dish catalog", () => {
  it("contains every owner dish exactly once (salad as five variants)", () => {
    expect(OWNER_DISHES).toHaveLength(56);
    expect(CATALOG_DISHES.map((dish) => dish.name).sort()).toEqual([...OWNER_DISHES, ...SALAD_VARIANTS].sort());
  });

  it("is valid against the dish API schema", () => {
    for (const seed of CATALOG_DISHES) expect(() => validate(createDishSchema, seed), seed.name).not.toThrow();
  });

  it("uses only catalog ingredients with fitting units (FOOD-021)", async () => {
    const map = await catalogIngredients();
    for (const seed of CATALOG_DISHES) {
      expect((await derived(seed)).unknownIngredients, seed.name).toEqual([]);
      expect(seed.ingredients.every((entry) => map.has(entry.ingredientId)), seed.name).toBe(true);
    }
  });

  it("groups the variants", () => {
    const group = (name: string) => CATALOG_DISHES.filter((dish) => dish.group === name).map((dish) => dish.name).sort();
    expect(group("Bratkartoffeln")).toEqual(["Bratkartoffeln mit Ei", "Bratkartoffeln mit Würstl"]);
    expect(group("Spätzle")).toEqual(["Spätzle", "Spätzle mit Hackbraten", "Spätzle mit Soße"]);
    expect(group("Gnocchi")).toEqual(["Gnocchi in Spinatsoße", "Gnocchi in Tomatensoße", "Gnocchi mit Spinat & Feta"]);
    expect(group("Salat mit Protein")).toEqual([...SALAD_VARIANTS].sort());
  });

  it("never needs nuts; apple only as an optional side", async () => {
    for (const seed of CATALOG_DISHES) {
      const values = await derived(seed);
      expect(values.tags, seed.name).not.toContain("NUTS");
      expect(values.tags, seed.name).not.toContain("APPLE");
    }
    expect((await derived(CATALOG_DISHES.find((dish) => dish.name === "Kartoffelpuffer") as SeedDish)).optionalTags).toContain("APPLE");
  });

  it("has a vegetarian variant for every meat or fish dish beyond the vegetarian's exceptions (R2)", async () => {
    for (const seed of CATALOG_DISHES) {
      const values = await derived(seed);
      const needsVariant = !values.isVegetarian && values.proteinSources.some((source) => !VEGETARIAN_EXCEPTIONS.includes(source));
      if (needsVariant) expect(seed.vegetarianVariant, seed.name).toBeDefined();
    }
  });

  it("classifies protein forms and bases (decisions 3 and 4)", async () => {
    const proteins = async (name: string) => (await derived(CATALOG_DISHES.find((dish) => dish.name === name) as SeedDish)).proteinSources;
    expect(await proteins("Spaghetti Bolognese")).toEqual(["MINCE"]);
    expect(await proteins("Frikadellen mit Kartoffelbrei")).toEqual(["MEATBALL"]);
    expect(await proteins("Burger")).toEqual(["BURGER_PATTY"]);
    expect(await proteins("Hot Dogs")).toEqual(["SAUSAGE"]);
    expect(await proteins("Chicken Dinos mit Pommes")).toEqual(["POULTRY"]);
    expect(await proteins("Salat mit Ei")).toEqual([]);
    const base = async (name: string) => (await derived(CATALOG_DISHES.find((dish) => dish.name === name) as SeedDish)).baseTags;
    expect(await base("Spätzle")).toEqual(["PASTA"]);
    expect(await base("Gnocchi in Tomatensoße")).toEqual(["GNOCCHI"]);
    expect(await base("Schupfnudeln")).toEqual(["SCHUPFNUDELN"]);
  });

  it("keeps every catalog dish within 20 active minutes (owner, 2026-10-07)", () => {
    expect(CATALOG_DISHES.filter((dish) => dish.activeMinutes > 20).map((dish) => dish.name)).toEqual([]);
  });

  it("offers enough light lunches for a week and marks burgers", () => {
    const lightLunches = CATALOG_DISHES.filter((dish) => dish.slots.includes("LUNCH") && dish.lightness === "LIGHT" && dish.activeMinutes <= 20);
    expect(lightLunches.length).toBeGreaterThanOrEqual(10);
    expect(CATALOG_DISHES.filter((dish) => dish.isBurger).map((dish) => dish.name).sort()).toEqual(["Burger", "Burgerwraps", "Piratenburger"]);
  });
});

describe("MealCatalogImportService", () => {
  it("previews without writing", async () => {
    const { importer, meals } = setup();
    const preview = await importer.importCatalog(TEST_IDENTITY, true);
    expect(preview).toMatchObject({ dryRun: true, dishesSkipped: [] });
    expect(preview.dishesCreated).toHaveLength(CATALOG_DISHES.length);
    expect(meals.items.size).toBe(0);
  });

  it("imports all dishes once and skips existing names on the next run", async () => {
    const { importer, dishes } = setup();
    const first = await importer.importCatalog(TEST_IDENTITY, false);
    expect(first.dishesCreated).toHaveLength(CATALOG_DISHES.length);
    const listed = await dishes.listDishes("default");
    expect(listed).toHaveLength(CATALOG_DISHES.length);
    expect(listed.find((dish) => dish.name === "Frikadellen mit Kartoffelbrei")).toMatchObject({ proteinSources: ["MEATBALL"], vegetarianVariant: "mit Gemüsefrikadellen" });
    const second = await importer.importCatalog(TEST_IDENTITY, false);
    expect(second).toMatchObject({ dishesCreated: [] });
    expect(second.dishesSkipped).toHaveLength(CATALOG_DISHES.length);
  });

  it("never touches edited or archived dishes", async () => {
    const { importer, dishes } = setup();
    await importer.importCatalog(TEST_IDENTITY, false);
    const ramen = (await dishes.listDishes("default")).find((dish) => dish.name === "Ramen");
    if (!ramen) throw new Error("Ramen missing");
    await dishes.updateDish(TEST_IDENTITY, ramen.dishId, { activeMinutes: 5, totalMinutes: 5 });
    await dishes.archiveDish(TEST_IDENTITY, ramen.dishId);
    const again = await importer.importCatalog(TEST_IDENTITY, false);
    expect(again.dishesCreated).toEqual([]);
    expect(await dishes.getDish("default", ramen.dishId)).toMatchObject({ activeMinutes: 5, archived: true });
  });
});

/** The owner's review sheet (FOOD-003): regenerate with UPDATE_REVIEW_SHEET=1 npx vitest run tests/meals-catalog.test.ts */
describe("review sheet", () => {
  const SLOT = { LUNCH: "M", DINNER: "A" } as const;
  const PROTEIN: Record<string, string> = { POULTRY: "Geflügel", FISH: "Fisch", MINCE: "Hack", BURGER_PATTY: "Burger-Patty", SAUSAGE: "Würstchen", MEATBALL: "Hackbällchen", HAM: "Schinken" };
  const BASE: Record<string, string> = { PASTA: "Nudeln", GNOCCHI: "Gnocchi", SCHUPFNUDELN: "Schupfnudeln", RICE: "Reis", POTATO: "Kartoffeln", BREAD: "Brot", GRAIN: "Getreide" };

  async function render(): Promise<string> {
    const map = await catalogIngredients();
    const rows = await Promise.all(
      [...CATALOG_DISHES].sort((a, b) => a.name.localeCompare(b.name, "de")).map(async (seed) => {
        const values = deriveDish(seed, map);
        const ingredients = seed.ingredients.map((entry) => `${map.get(entry.ingredientId)?.name ?? entry.ingredientId}${entry.optional ? " (opt.)" : ""}`).join(", ");
        const time = `${seed.activeMinutes}${seed.activeMinutes > 20 ? " ⚠" : ""} / ${seed.totalMinutes}`;
        return `| ${seed.name} | ${seed.slots.map((slot) => SLOT[slot]).join("+")} | ${seed.lightness === "LIGHT" ? "leicht" : "sättigend"} | ${values.isVegetarian ? "ja" : "nein"} | ${values.proteinSources.map((tag) => PROTEIN[tag]).join(", ") || "–"} | ${values.baseTags.map((tag) => BASE[tag]).join(", ") || "–"} | ${time} | ${seed.vegetarianVariant ?? "–"}${seed.isBurger ? " · Burger" : ""}${seed.group ? ` · Gruppe ${seed.group}` : ""} | ${ingredients} |`;
      }),
    );
    return [
      "# Gerichtekatalog – Prüfblatt (FOOD-003)",
      "",
      "Generiert aus `backend/src/meals/catalog/dishes.ts` (Test `backend/tests/meals-catalog.test.ts`; neu erzeugen mit",
      "`UPDATE_REVIEW_SHEET=1 npx vitest run tests/meals-catalog.test.ts` in `backend/`). Bitte prüfen: Mahlzeit (M = mittags,",
      "A = abends), leicht oder sättigend, Proteinquelle, Grundzutat und aktive Kochzeit. ⚠ = mehr als 20 Minuten aktiv: wird",
      "mit der Standardregel nicht geplant, bis Zeit oder Grenze angepasst sind. Mengen pro Erwachsenenportion stehen im Code.",
      "",
      `${CATALOG_DISHES.length} Gerichte.`,
      "",
      "| Gericht | Mahlzeit | Art | Vegetarisch | Protein | Grundzutat | Minuten aktiv / gesamt | Variante, Hinweise | Zutaten |",
      "|---|---|---|---|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n");
  }

  it("matches the catalog", async () => {
    const expected = await render();
    if (process.env.UPDATE_REVIEW_SHEET === "1") writeFileSync(REVIEW_SHEET, expected);
    expect(readFileSync(REVIEW_SHEET, "utf8")).toBe(expected);
  });
});
