import { describe, expect, it } from "vitest";
import { CHICKEN, EGG, FAMILY, INGREDIENTS, MINCE, SPAGHETTI, TOFU, WALNUTS, dish } from "../../tests/dishFixtures";
import {
  deriveDraft,
  dishSummaryLine,
  filterDishes,
  ruleHints,
  unitsFor,
  validateDraft,
  type DishInput,
} from "./dishes";

const entry = (ingredientId: string, optional = false) => ({
  ingredientId,
  quantity: 100,
  unit: "g" as const,
  optional,
});

const draft = (fields: Partial<DishInput> = {}): DishInput => ({
  name: "Nudeln mit Soße",
  group: null,
  category: "PASTA",
  slots: ["DINNER"],
  lightness: "FILLING",
  temperature: "WARM",
  ingredients: [entry(SPAGHETTI.ingredientId)],
  activeMinutes: 15,
  totalMinutes: 15,
  vegetarianVariant: null,
  familyFriendly: true,
  isBurger: false,
  ...fields,
});

const texts = (input: DishInput) =>
  ruleHints(input, deriveDraft(input.ingredients, INGREDIENTS), FAMILY).map((hint) => `${hint.severity}: ${hint.text}`);

describe("dishes (FOOD-010)", () => {
  it("offers spoons for weighed ingredients and only pieces for counted ones", () => {
    expect(unitsFor(SPAGHETTI)).toEqual(["g", "EL", "TL"]);
    expect(unitsFor(EGG)).toEqual(["Stück"]);
  });

  it("derives tags, protein, base and vegetarian like the backend; optional ingredients only add optional tags", () => {
    expect(
      deriveDraft(
        [entry(SPAGHETTI.ingredientId), entry(MINCE.ingredientId), entry(WALNUTS.ingredientId, true)],
        INGREDIENTS,
      ),
    ).toEqual({
      isVegetarian: false,
      tags: ["GLUTEN", "MEAT", "BEEF"],
      optionalTags: ["NUTS"],
      proteinSources: ["MINCE"],
      baseTags: ["PASTA"],
    });
    expect(
      deriveDraft([entry(SPAGHETTI.ingredientId), entry(MINCE.ingredientId, true), entry("i-unknown")], INGREDIENTS)
        .isVegetarian,
    ).toBe(true);
  });

  it("names the eaters a dish excludes: allergy, diet without exception, dislikes", () => {
    expect(
      texts(
        draft({
          ingredients: [
            entry(SPAGHETTI.ingredientId),
            entry(WALNUTS.ingredientId),
            entry(CHICKEN.ingredientId),
            entry(EGG.ingredientId),
          ],
        }),
      ),
    ).toEqual([
      "error: Nicht für Erwachsener 1: Allergie (Nüsse).",
      "error: Nicht für Erwachsener 2: nicht vegetarisch und keine vegetarische Variante.",
      "warning: Erwachsener 2 mag es nicht (eine Zutat, die nicht gemocht wird): wird nicht geplant, wenn Erwachsener 2 mitisst.",
      "info: Hühnchen: nur zu den Mahlzeiten, die ihr dafür erlaubt habt, höchstens 1× pro Woche.",
    ]);
  });

  it("accepts a vegetarian exception or a vegetarian variant", () => {
    expect(texts(draft({ ingredients: [entry(SPAGHETTI.ingredientId), entry(MINCE.ingredientId)] }))).toEqual([]);
    expect(
      texts(draft({ ingredients: [entry(CHICKEN.ingredientId)], vegetarianVariant: "mit Tofu-Nuggets" })),
    ).not.toContain("error: Nicht für Erwachsener 2: nicht vegetarisch und keine vegetarische Variante.");
  });

  it("shows household rules: dislikes, cooking time, light weekday lunch, family-friendly", () => {
    expect(
      texts(
        draft({
          ingredients: [entry(TOFU.ingredientId)],
          activeMinutes: 35,
          totalMinutes: 35,
          slots: ["LUNCH"],
          familyFriendly: false,
        }),
      ),
    ).toEqual([
      "error: Enthält etwas, das ihr nicht esst (Tofu): wird nie geplant.",
      "error: 35 Minuten aktive Kochzeit, erlaubt sind 20: wird nie geplant.",
      "info: Sättigend: mittags nur am Wochenende (unter der Woche gibt es mittags Leichtes).",
      "error: Nicht familientauglich: wird nicht geplant.",
    ]);
    expect(ruleHints(draft(), deriveDraft([], INGREDIENTS), undefined)).toEqual([]);
  });

  it("validates every field with the backend limits", () => {
    expect(validateDraft(draft())).toEqual({});
    expect(
      validateDraft(
        draft({
          name: " A ",
          group: "x".repeat(61),
          slots: [],
          ingredients: [
            { ...entry(SPAGHETTI.ingredientId), quantity: Number.NaN },
            { ...entry(MINCE.ingredientId), quantity: 5001 },
          ],
          activeMinutes: 1.5,
          totalMinutes: 700,
          vegetarianVariant: "y".repeat(81),
        }),
      ),
    ).toEqual({
      name: "Bitte mindestens 2 Zeichen.",
      group: "Höchstens 60 Zeichen.",
      slots: "Bitte Mittag, Abend oder beides wählen.",
      "ingredients.0.quantity": "Menge zwischen 0 und 5000.",
      "ingredients.1.quantity": "Menge zwischen 0 und 5000.",
      activeMinutes: "Ganze Minuten zwischen 1 und 240.",
      totalMinutes: "Ganze Minuten zwischen 1 und 600.",
      vegetarianVariant: "Höchstens 80 Zeichen.",
    });
    expect(
      validateDraft(draft({ name: "x".repeat(81), ingredients: [], activeMinutes: 30, totalMinutes: 20 })),
    ).toEqual({
      name: "Höchstens 80 Zeichen.",
      ingredients: "Bitte mindestens eine Zutat hinzufügen.",
      totalMinutes: "Die Gesamtzeit darf nicht kürzer als die aktive Zeit sein.",
    });
  });

  it("filters by search (name and group), slot, vegetarian and category", () => {
    const bolognese = dish();
    const salad = dish({
      dishId: "d-2",
      name: "Griechischer Salat",
      group: undefined,
      category: "SALAD",
      slots: ["LUNCH"],
      isVegetarian: true,
    });
    const burger = dish({
      dishId: "d-3",
      name: "Burger",
      group: undefined,
      category: "BURGER_WRAP",
      slots: ["DINNER"],
      vegetarianVariant: "Veggie-Patty",
    });
    const all = [bolognese, salad, burger];
    const none = { search: "", slot: "ALL", vegetarianOnly: false, category: "ALL" } as const;
    expect(filterDishes(all, none)).toEqual(all);
    expect(filterDishes(all, { ...none, search: " BOLO" })).toEqual([bolognese]);
    expect(filterDishes(all, { ...none, slot: "LUNCH" })).toEqual([bolognese, salad]);
    expect(filterDishes(all, { ...none, vegetarianOnly: true })).toEqual([salad, burger]);
    expect(filterDishes(all, { ...none, category: "SALAD" })).toEqual([salad]);
  });

  it("summarises slots and times", () => {
    expect(dishSummaryLine(dish())).toBe("Mittag, Abend · 20 Min. aktiv (40 Min. gesamt)");
    expect(dishSummaryLine(dish({ slots: ["DINNER"], totalMinutes: 20 }))).toBe("Abend · 20 Min.");
  });
});
