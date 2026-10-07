/**
 * Family dish catalog (FOOD-003): the owner's dish list and favorites (EPIC-FOOD-001, 57 dishes; „Salat mit
 * Protein“ as five variants). Quantities per adult portion, ingredients from the catalog (FOOD-021).
 * `activeMinutes` is hands-on time (decision 1). The owner has optimized every catalog dish to at most 20 active
 * minutes (2026-10-07); only new dishes are held to the time rule. Review sheet: docs/release-2.0/food-catalog-review.md.
 */

import type { DishCategory, Lightness, MealSlot, Temperature } from "../models/dish.js";
import type { BaseTag, ProteinTag, QuantityUnit } from "../models/ingredient.js";

export interface SeedIngredient {
  readonly ingredientId: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly optional?: boolean;
}

export interface SeedDish {
  readonly name: string;
  readonly group?: string;
  readonly category: DishCategory;
  readonly slots: readonly MealSlot[];
  readonly lightness: Lightness;
  readonly temperature: Temperature;
  readonly ingredients: readonly SeedIngredient[];
  readonly activeMinutes: number;
  readonly totalMinutes: number;
  readonly vegetarianVariant?: string;
  readonly isBurger?: boolean;
  readonly proteinSourcesOverride?: readonly ProteinTag[];
  readonly baseTagsOverride?: readonly BaseTag[];
}

const BOTH: readonly MealSlot[] = ["LUNCH", "DINNER"];
const LUNCH: readonly MealSlot[] = ["LUNCH"];

const g = (ingredientId: string, quantity: number): SeedIngredient => ({ ingredientId, quantity, unit: "g" });
const ml = (ingredientId: string, quantity: number): SeedIngredient => ({ ingredientId, quantity, unit: "ml" });
const pcs = (ingredientId: string, quantity: number): SeedIngredient => ({ ingredientId, quantity, unit: "Stück" });
const tbsp = (ingredientId: string, quantity = 1): SeedIngredient => ({ ingredientId, quantity, unit: "EL" });
const tsp = (ingredientId: string, quantity = 1): SeedIngredient => ({ ingredientId, quantity, unit: "TL" });
const optional = (ingredient: SeedIngredient): SeedIngredient => ({ ...ingredient, optional: true });

/** Shared by the salad variants. */
const SALAD_BASE = [g("lettuce", 80), g("cucumber", 60), g("cherry-tomato", 60), ml("salad-dressing", 20)];
const SALAD = { group: "Salat mit Protein", category: "SALAD", slots: BOTH, lightness: "LIGHT", temperature: "COLD", activeMinutes: 10, totalMinutes: 10 } as const;

export const CATALOG_DISHES: readonly SeedDish[] = [
  // Pasta
  { name: "Nudeln mit Soße", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("pasta", 125), g("passata", 150), tsp("italian-herbs"), optional(tbsp("parmesan"))], activeMinutes: 10, totalMinutes: 15 },
  {
    name: "Spaghetti Bolognese",
    category: "PASTA",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("pasta", 125), g("beef-mince", 100), g("passata", 150), g("onion", 30), g("carrot", 40), tbsp("tomato-paste"), optional(tbsp("parmesan"))],
    activeMinutes: 15,
    totalMinutes: 30,
  },
  { name: "One Pot Pasta", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("pasta", 125), g("cherry-tomato", 100), g("spinach-frozen", 50), g("cream-cheese", 40), tsp("vegetable-broth")], activeMinutes: 10, totalMinutes: 20 },
  { name: "Käsemakkaroni", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("pasta", 125), ml("milk", 100), g("grated-cheese", 60), g("butter", 10), g("flour", 10)], activeMinutes: 15, totalMinutes: 20 },
  { name: "Ofenrigatoni", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("pasta", 125), g("passata", 150), g("mozzarella", 60), g("grated-cheese", 20), tsp("italian-herbs")], activeMinutes: 15, totalMinutes: 35 },
  { name: "Tortellini", group: "Tortellini", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("tortellini", 200), g("passata", 120), optional(tbsp("parmesan"))], activeMinutes: 10, totalMinutes: 15 },
  {
    name: "Tortellini mit Frischkäsefüllung & Brokkoli",
    group: "Tortellini",
    category: "PASTA",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("tortellini-cream-cheese", 200), g("broccoli", 150), ml("cooking-cream", 50), g("parmesan", 10)],
    activeMinutes: 10,
    totalMinutes: 15,
  },
  { name: "Ravioli", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("ravioli", 200), g("passata", 120), optional(tbsp("parmesan"))], activeMinutes: 10, totalMinutes: 15 },
  {
    name: "Lasagne",
    category: "PASTA",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("lasagne-sheets", 80), g("beef-mince", 100), g("passata", 150), g("onion", 30), ml("milk", 100), g("butter", 10), g("flour", 10), g("grated-cheese", 40)],
    activeMinutes: 20,
    totalMinutes: 70,
  },
  { name: "Nudelauflauf", category: "PASTA", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("pasta", 125), g("broccoli", 100), ml("cooking-cream", 80), pcs("egg", 1), g("grated-cheese", 50)], activeMinutes: 15, totalMinutes: 45 },

  // Potatoes
  {
    name: "Kartoffelsuppe mit Würstl",
    category: "SOUP",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("potato", 250), g("carrot", 50), g("onion", 30), ml("cream", 40), tsp("vegetable-broth", 2), pcs("sausage", 1)],
    activeMinutes: 15,
    totalMinutes: 35,
  },
  { name: "Kartoffeln mit Butter", category: "POTATO", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("potato", 300), g("butter", 15), optional(g("herb-quark", 100))], activeMinutes: 5, totalMinutes: 25 },
  { name: "Kartoffelpuffer", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("potato-pancake-frozen", 250), optional(g("applesauce", 100))], activeMinutes: 10, totalMinutes: 25 },
  { name: "Kartoffelmuffins", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("potato", 200), pcs("egg", 1), g("grated-cheese", 40), g("flour", 20)], activeMinutes: 15, totalMinutes: 40 },
  { name: "Bratkartoffeln mit Ei", group: "Bratkartoffeln", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("potato", 300), pcs("egg", 2), g("onion", 50), tbsp("oil")], activeMinutes: 20, totalMinutes: 30 },
  { name: "Bratkartoffeln mit Würstl", group: "Bratkartoffeln", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("potato", 300), pcs("sausage", 2), g("onion", 50), tbsp("oil")], activeMinutes: 20, totalMinutes: 30 },
  {
    name: "Frikadellen mit Kartoffelbrei",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("mixed-mince", 120), pcs("egg", 0.5), g("breadcrumbs", 15), g("onion", 30), g("potato", 250), ml("milk", 60), g("butter", 10)],
    activeMinutes: 20,
    totalMinutes: 35,
    vegetarianVariant: "mit Gemüsefrikadellen",
    proteinSourcesOverride: ["MEATBALL"],
  },
  {
    name: "Fischstäbchen-Auflauf mit Kartoffeln und Spinat",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("fish-fingers-frozen", 120), g("potato", 200), g("spinach-frozen", 150), ml("cooking-cream", 60), g("grated-cheese", 30)],
    activeMinutes: 15,
    totalMinutes: 45,
    vegetarianVariant: "ohne Fischstäbchen, mit Feta",
  },
  { name: "Rösti mit Kräuterquark", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("roesti-frozen", 250), g("herb-quark", 100)], activeMinutes: 10, totalMinutes: 25 },
  { name: "Eier in Senfsoße mit Kartoffeln", category: "POTATO", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [pcs("egg", 2), g("potato", 250), ml("cooking-cream", 80), tbsp("mustard", 2), g("flour", 10), g("butter", 10)], activeMinutes: 20, totalMinutes: 25 },

  // Gnocchi
  { name: "Gnocchi in Tomatensoße", group: "Gnocchi", category: "VEGETARIAN", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("gnocchi", 250), g("passata", 150), tsp("italian-herbs"), optional(g("mozzarella", 50))], activeMinutes: 10, totalMinutes: 15 },
  { name: "Gnocchi in Spinatsoße", group: "Gnocchi", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("gnocchi", 250), g("spinach-frozen", 150), ml("cooking-cream", 80), g("parmesan", 15)], activeMinutes: 10, totalMinutes: 15 },
  { name: "Gnocchi mit Spinat & Feta", group: "Gnocchi", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("gnocchi", 250), g("spinach-frozen", 150), g("feta", 50), ml("cooking-cream", 50)], activeMinutes: 10, totalMinutes: 15 },

  // Rice
  { name: "Eierreis mit Gemüse", category: "RICE", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("rice", 80), pcs("egg", 2), g("vegetable-mix-frozen", 150), tbsp("soy-sauce"), g("spring-onion", 15)], activeMinutes: 15, totalMinutes: 25 },
  { name: "Mikrowellenrisotto", category: "RICE", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("risotto-rice", 80), tsp("vegetable-broth", 2), g("peas-frozen", 60), g("parmesan", 20), g("butter", 10)], activeMinutes: 5, totalMinutes: 20 },
  {
    name: "Chili",
    category: "RICE",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("beef-mince", 100), g("kidney-beans", 80), g("corn", 50), g("chopped-tomatoes", 150), g("onion", 30), g("rice", 70), tsp("paprika-powder")],
    activeMinutes: 15,
    totalMinutes: 35,
  },
  { name: "Reispfanne mit Paprika & Zucchini", category: "RICE", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("rice", 80), g("bell-pepper", 100), g("zucchini", 100), tbsp("soy-sauce"), tbsp("oil")], activeMinutes: 15, totalMinutes: 25 },
  {
    name: "Curryreis mit Kokosmilch (mild)",
    category: "RICE",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("rice", 80), ml("coconut-milk", 100), g("vegetable-mix-frozen", 100), g("peas-frozen", 50), tsp("curry-powder")],
    activeMinutes: 10,
    totalMinutes: 25,
  },

  // Burgers and wraps
  {
    name: "Burger",
    category: "BURGER_WRAP",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [pcs("burger-bun", 1), g("burger-patty", 125), g("tomato", 40), g("lettuce", 15), g("sliced-cheese", 20), tbsp("ketchup")],
    activeMinutes: 15,
    totalMinutes: 20,
    vegetarianVariant: "mit Gemüse-Patty",
    isBurger: true,
  },
  {
    name: "Burgerwraps",
    category: "BURGER_WRAP",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [pcs("wrap", 2), g("beef-mince", 100), g("tomato", 50), g("lettuce", 20), g("grated-cheese", 30), tbsp("ketchup")],
    activeMinutes: 15,
    totalMinutes: 20,
    isBurger: true,
  },
  {
    name: "Piratenburger",
    category: "BURGER_WRAP",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [pcs("burger-bun", 1), g("burger-patty", 100), g("cucumber", 30), g("sliced-cheese", 20), tbsp("ketchup")],
    activeMinutes: 15,
    totalMinutes: 20,
    vegetarianVariant: "mit Gemüse-Patty",
    isBurger: true,
  },
  {
    name: "Gemüsefrikadellen",
    category: "VEGETARIAN",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("carrot", 100), g("zucchini", 100), pcs("egg", 1), g("breadcrumbs", 30), g("grated-cheese", 30), g("potato", 150)],
    activeMinutes: 20,
    totalMinutes: 35,
  },
  { name: "Hot Dogs", category: "BURGER_WRAP", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [pcs("hot-dog-bun", 2), pcs("sausage", 2), tbsp("ketchup"), tsp("mustard"), optional(g("fried-onions", 10))], activeMinutes: 10, totalMinutes: 10 },

  // Meat and fish
  {
    name: "Spätzle mit Hackbraten",
    group: "Spätzle",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("spaetzle", 200), g("mixed-mince", 120), pcs("egg", 0.5), g("breadcrumbs", 15), g("onion", 30), ml("cooking-cream", 60)],
    activeMinutes: 20,
    totalMinutes: 70,
    vegetarianVariant: "mit Gemüsebratling",
    proteinSourcesOverride: ["MEATBALL"],
  },
  { name: "Spätzle mit Soße", group: "Spätzle", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("spaetzle", 200), g("mushroom", 100), ml("cooking-cream", 80), g("onion", 30)], activeMinutes: 15, totalMinutes: 20 },
  {
    name: "Köttbullar",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("meatballs-frozen", 150), g("potato", 250), ml("cooking-cream", 60)],
    activeMinutes: 15,
    totalMinutes: 25,
    vegetarianVariant: "mit Gemüsebällchen",
  },
  {
    name: "Chicken Dinos mit Pommes",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("chicken-nuggets-frozen", 150), g("fries-frozen", 150), tbsp("ketchup")],
    activeMinutes: 5,
    totalMinutes: 25,
    vegetarianVariant: "mit Veggie-Nuggets",
  },
  {
    name: "Fischstäbchen mit Erbsenpüree",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("fish-fingers-frozen", 150), g("peas-frozen", 150), g("butter", 10), ml("cream", 20)],
    activeMinutes: 10,
    totalMinutes: 20,
    vegetarianVariant: "mit Gemüsestäbchen",
  },
  {
    name: "Gebratener Lachs mit Gemüse",
    category: "MEAT_FISH",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("salmon", 130), g("broccoli", 150), g("carrot", 80), g("potato", 150), tbsp("oil")],
    activeMinutes: 15,
    totalMinutes: 25,
    vegetarianVariant: "mit Halloumi statt Lachs",
  },

  // Vegetarian and classics
  { name: "Spätzle", group: "Spätzle", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("spaetzle", 200), g("butter", 15), g("peas-frozen", 80), optional(tbsp("parmesan"))], activeMinutes: 10, totalMinutes: 15 },
  { name: "Käsespätzle mit Röstzwiebeln", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("spaetzle", 200), g("grated-cheese", 60), g("fried-onions", 15), g("butter", 10)], activeMinutes: 15, totalMinutes: 25 },
  { name: "Schupfnudeln", category: "VEGETARIAN", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [g("schupfnudeln", 250), g("butter", 15), g("onion", 30), optional(g("ham-cubes", 40))], activeMinutes: 10, totalMinutes: 15 },
  { name: "Grießbrei", category: "SWEET", slots: LUNCH, lightness: "FILLING", temperature: "WARM", ingredients: [g("semolina", 50), ml("milk", 300), g("sugar", 15), g("butter", 5), optional(g("cinnamon-sugar", 5))], activeMinutes: 10, totalMinutes: 15 },
  {
    name: "Kaiserschmarrn",
    category: "SWEET",
    slots: LUNCH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [g("flour", 60), pcs("egg", 1.5), ml("milk", 100), g("sugar", 10), g("butter", 15), optional(g("raisins", 15)), optional(g("applesauce", 100)), g("powdered-sugar", 5)],
    activeMinutes: 20,
    totalMinutes: 25,
  },
  {
    name: "Ofengemüse mit Kräuterquark",
    category: "VEGETARIAN",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("potato", 200), g("bell-pepper", 100), g("zucchini", 100), g("carrot", 80), g("herb-quark", 100), tbsp("olive-oil")],
    activeMinutes: 10,
    totalMinutes: 40,
  },
  {
    name: "Gebratener Halloumi mit Ofengemüse",
    category: "VEGETARIAN",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("halloumi", 80), g("bell-pepper", 100), g("zucchini", 100), g("carrot", 80), g("potato", 150), tbsp("olive-oil")],
    activeMinutes: 15,
    totalMinutes: 40,
  },
  { name: "Gemüsecurry", category: "VEGETARIAN", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [g("vegetable-mix-frozen", 200), ml("coconut-milk", 80), tsp("curry-powder"), g("rice", 70)], activeMinutes: 15, totalMinutes: 25 },
  {
    name: "Linseneintopf",
    category: "SOUP",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("red-lentils", 60), g("carrot", 80), g("potato", 100), g("onion", 30), tsp("vegetable-broth", 2), tbsp("tomato-paste")],
    activeMinutes: 15,
    totalMinutes: 35,
  },
  {
    name: "Ramen",
    category: "SOUP",
    slots: BOTH,
    lightness: "LIGHT",
    temperature: "WARM",
    ingredients: [g("ramen-noodles", 80), pcs("egg", 1), g("vegetable-mix-frozen", 100), tbsp("soy-sauce"), tsp("vegetable-broth", 2), g("spring-onion", 15)],
    activeMinutes: 15,
    totalMinutes: 20,
  },
  { name: "Onigiri", category: "VEGETARIAN", slots: LUNCH, lightness: "LIGHT", temperature: "COLD", ingredients: [g("sushi-rice", 80), pcs("nori", 2), g("cucumber", 40), optional(tsp("sesame")), optional(tbsp("soy-sauce"))], activeMinutes: 15, totalMinutes: 35 },
  {
    name: "Toast Hawaii",
    category: "SNACK",
    slots: BOTH,
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [pcs("toast", 2), g("ham", 40), g("pineapple", 60), g("sliced-cheese", 40)],
    activeMinutes: 10,
    totalMinutes: 20,
    vegetarianVariant: "ohne Schinken",
  },
  { name: "Flammkuchen", category: "SNACK", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [pcs("flammkuchen-dough", 0.5), g("creme-fraiche", 75), g("onion", 50), optional(g("ham-cubes", 40))], activeMinutes: 10, totalMinutes: 25 },
  { name: "Pfannenpizza (Wrap-Boden)", category: "SNACK", slots: BOTH, lightness: "FILLING", temperature: "WARM", ingredients: [pcs("wrap", 2), g("passata", 60), g("mozzarella", 60), tsp("italian-herbs")], activeMinutes: 15, totalMinutes: 15 },
  { name: "Mozzarella-Tomaten-Baguettes", category: "SNACK", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [pcs("baguette", 0.5), g("mozzarella", 60), g("tomato", 80), tsp("italian-herbs")], activeMinutes: 10, totalMinutes: 20 },
  { name: "Kontaktgrill-Sandwiches", category: "SNACK", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [pcs("toast", 2), g("mozzarella", 50), g("tomato", 60)], activeMinutes: 10, totalMinutes: 10 },
  { name: "Gemüse-Toasts aus dem Ofen", category: "SNACK", slots: BOTH, lightness: "LIGHT", temperature: "WARM", ingredients: [pcs("toast", 2), g("zucchini", 80), g("tomato", 50), g("grated-cheese", 30)], activeMinutes: 10, totalMinutes: 20 },

  // Salad with protein: one dish per protein (R5, R7)
  { ...SALAD, name: "Salat mit Halloumi", ingredients: [...SALAD_BASE, g("halloumi", 80)] },
  { ...SALAD, name: "Salat mit Ei", ingredients: [...SALAD_BASE, pcs("egg", 2)] },
  { ...SALAD, name: "Salat mit Feta", ingredients: [...SALAD_BASE, g("feta", 60)] },
  { ...SALAD, name: "Salat mit Lachs", ingredients: [...SALAD_BASE, g("salmon", 100)], vegetarianVariant: "mit Feta statt Lachs" },
  { ...SALAD, name: "Salat mit Hähnchen", ingredients: [...SALAD_BASE, g("chicken-breast", 120)], activeMinutes: 15, totalMinutes: 15, vegetarianVariant: "mit Halloumi statt Hähnchen" },
];
