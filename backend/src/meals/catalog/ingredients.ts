/**
 * Ingredient catalog (FOOD-021): the ingredients of the family dish catalog (FOOD-003) plus common extras.
 * Values are rough, self-maintained estimates: nutrition per 100 g, price in EUR per 100 g / 100 ml or per piece.
 * No licensed food database and no live prices; the UI labels them „ca.“.
 */

import type { BaseTag, Ingredient, IngredientTag, IngredientUnit, ProteinTag, ShoppingSection } from "../models/ingredient.js";

interface Options {
  readonly tags?: readonly IngredientTag[];
  readonly protein?: ProteinTag;
  readonly base?: BaseTag;
  readonly pantry?: boolean;
  readonly gramsPerPiece?: number;
}

/** [kcal, protein, carbs, fat] per 100 g. */
type Values = readonly [number, number, number, number];

function ingredient(ingredientId: string, name: string, unit: IngredientUnit, shoppingSection: ShoppingSection, values: Values, pricePerUnit: number, options: Options = {}): Ingredient {
  const [kcal, protein, carbs, fat] = values;
  return {
    ingredientId,
    name,
    unit,
    ...(options.gramsPerPiece === undefined ? {} : { gramsPerPiece: options.gramsPerPiece }),
    tags: options.tags ?? [],
    ...(options.protein === undefined ? {} : { proteinTag: options.protein }),
    ...(options.base === undefined ? {} : { baseTag: options.base }),
    shoppingSection,
    nutritionPer100g: { kcal, protein, carbs, fat },
    pricePerUnit,
    pantry: options.pantry ?? false,
  };
}

const VEG = "GEMUESE_OBST";
const BAKERY = "BACKWAREN";
const CHILLED = "KUEHLREGAL";
const MEAT_FISH = "FLEISCH_FISCH";
const FROZEN = "TIEFKUEHL";
const DRY = "TROCKENWAREN";
const SPICES = "GEWUERZE";

export const CATALOG_INGREDIENTS: readonly Ingredient[] = [
  // Vegetables and fruit
  ingredient("tomato", "Tomaten", "g", VEG, [18, 0.9, 3.9, 0.2], 0.4),
  ingredient("cherry-tomato", "Cherrytomaten", "g", VEG, [20, 1, 4, 0.2], 0.7),
  ingredient("cucumber", "Gurke", "g", VEG, [15, 0.6, 3.6, 0.1], 0.25),
  ingredient("bell-pepper", "Paprika", "g", VEG, [26, 1, 6, 0.3], 0.5),
  ingredient("zucchini", "Zucchini", "g", VEG, [17, 1.2, 3.1, 0.3], 0.3),
  ingredient("broccoli", "Brokkoli", "g", VEG, [34, 2.8, 7, 0.4], 0.45),
  ingredient("carrot", "Karotten", "g", VEG, [41, 0.9, 10, 0.2], 0.15),
  ingredient("onion", "Zwiebeln", "g", VEG, [40, 1.1, 9, 0.1], 0.15),
  ingredient("spring-onion", "Frühlingszwiebeln", "g", VEG, [32, 1.8, 7, 0.2], 0.8),
  ingredient("garlic", "Knoblauch", "g", VEG, [149, 6.4, 33, 0.5], 0.8, { pantry: true }),
  ingredient("potato", "Kartoffeln", "g", VEG, [77, 2, 17, 0.1], 0.15, { base: "POTATO" }),
  ingredient("mushroom", "Champignons", "g", VEG, [22, 3.1, 3.3, 0.3], 0.6),
  ingredient("lettuce", "Salatmischung", "g", VEG, [17, 1.3, 3, 0.2], 0.8),
  ingredient("fresh-herbs", "Frische Kräuter", "g", VEG, [40, 3, 5, 0.6], 2),
  ingredient("apple", "Äpfel", "g", VEG, [52, 0.3, 14, 0.2], 0.3, { tags: ["APPLE"] }),
  ingredient("lemon", "Zitrone", "Stück", VEG, [29, 1.1, 9, 0.3], 0.4, { gramsPerPiece: 100 }),
  ingredient("avocado", "Avocado", "Stück", VEG, [160, 2, 9, 15], 1.2, { gramsPerPiece: 150 }),

  // Bakery
  ingredient("burger-bun", "Burgerbrötchen", "Stück", BAKERY, [265, 9, 49, 4], 0.4, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 75 }),
  ingredient("hot-dog-bun", "Hot-Dog-Brötchen", "Stück", BAKERY, [270, 9, 50, 4], 0.35, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 60 }),
  ingredient("toast", "Toastbrot", "Stück", BAKERY, [260, 8, 48, 3.5], 0.07, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 25 }),
  ingredient("baguette", "Aufback-Baguette", "Stück", BAKERY, [260, 8, 52, 1.5], 0.6, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 125 }),
  ingredient("wrap", "Weizen-Wraps", "Stück", BAKERY, [310, 8, 52, 7], 0.3, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 60 }),

  // Chilled
  ingredient("egg", "Eier", "Stück", CHILLED, [143, 13, 0.7, 10], 0.3, { tags: ["EGGS"], gramsPerPiece: 60 }),
  ingredient("milk", "Milch", "ml", CHILLED, [64, 3.4, 4.8, 3.6], 0.11, { tags: ["MILK"] }),
  ingredient("butter", "Butter", "g", CHILLED, [741, 0.7, 0.6, 83], 0.9, { tags: ["MILK"] }),
  ingredient("cream", "Sahne", "ml", CHILLED, [292, 2.4, 3.2, 30], 0.45, { tags: ["MILK"] }),
  ingredient("cooking-cream", "Kochsahne", "ml", CHILLED, [150, 3, 4, 15], 0.4, { tags: ["MILK"] }),
  ingredient("creme-fraiche", "Crème fraîche", "g", CHILLED, [292, 2.4, 3, 30], 0.8, { tags: ["MILK"] }),
  ingredient("sour-cream", "Schmand", "g", CHILLED, [240, 2.8, 3.5, 24], 0.6, { tags: ["MILK"] }),
  ingredient("cream-cheese", "Frischkäse", "g", CHILLED, [238, 5.4, 3.3, 22], 0.7, { tags: ["MILK"] }),
  ingredient("herb-quark", "Kräuterquark", "g", CHILLED, [150, 8, 3, 11], 0.6, { tags: ["MILK"] }),
  ingredient("quark", "Magerquark", "g", CHILLED, [67, 12, 4, 0.2], 0.4, { tags: ["MILK"] }),
  ingredient("yogurt", "Joghurt", "g", CHILLED, [61, 3.5, 4.7, 3.3], 0.3, { tags: ["MILK"] }),
  ingredient("mozzarella", "Mozzarella", "g", CHILLED, [250, 18, 1, 19], 0.9, { tags: ["MILK"] }),
  ingredient("feta", "Feta", "g", CHILLED, [264, 14, 4, 21], 1.1, { tags: ["MILK"] }),
  ingredient("parmesan", "Parmesan", "g", CHILLED, [431, 38, 0, 29], 2.5, { tags: ["MILK"] }),
  ingredient("grated-cheese", "Reibekäse", "g", CHILLED, [356, 25, 0, 28], 0.9, { tags: ["MILK"] }),
  ingredient("sliced-cheese", "Käsescheiben", "g", CHILLED, [350, 24, 0, 28], 0.9, { tags: ["MILK"] }),
  ingredient("camembert", "Camembert", "g", CHILLED, [300, 20, 0.5, 24], 1.2, { tags: ["MILK"] }),
  ingredient("halloumi", "Halloumi", "g", CHILLED, [321, 21, 2, 26], 1.6, { tags: ["MILK"] }),
  ingredient("gnocchi", "Gnocchi", "g", CHILLED, [133, 3.3, 29, 0.3], 0.4, { tags: ["GLUTEN"], base: "GNOCCHI" }),
  ingredient("schupfnudeln", "Schupfnudeln", "g", CHILLED, [160, 4, 33, 1], 0.45, { tags: ["GLUTEN", "EGGS"], base: "SCHUPFNUDELN" }),
  ingredient("spaetzle", "Spätzle", "g", CHILLED, [175, 6, 33, 2], 0.4, { tags: ["GLUTEN", "EGGS"], base: "PASTA" }),
  ingredient("tortellini", "Tortellini (Käsefüllung)", "g", CHILLED, [300, 12, 45, 8], 0.9, { tags: ["GLUTEN", "EGGS", "MILK"], base: "PASTA" }),
  ingredient("tortellini-cream-cheese", "Tortellini (Frischkäsefüllung)", "g", CHILLED, [290, 11, 44, 8], 0.9, { tags: ["GLUTEN", "EGGS", "MILK"], base: "PASTA" }),
  ingredient("ravioli", "Ravioli", "g", CHILLED, [270, 11, 40, 7], 0.9, { tags: ["GLUTEN", "EGGS", "MILK"], base: "PASTA" }),
  ingredient("flammkuchen-dough", "Flammkuchenteig", "Stück", CHILLED, [290, 7, 55, 4], 1.2, { tags: ["GLUTEN"], base: "BREAD", gramsPerPiece: 260 }),
  ingredient("ham", "Kochschinken", "g", CHILLED, [107, 19, 1, 3], 1.5, { tags: ["MEAT", "PORK"], protein: "HAM" }),
  ingredient("ham-cubes", "Schinkenwürfel", "g", CHILLED, [180, 17, 1, 12], 1.2, { tags: ["MEAT", "PORK"], protein: "HAM" }),

  // Meat and fish
  ingredient("chicken-breast", "Hähnchenbrust", "g", MEAT_FISH, [110, 23, 0, 1.5], 1, { tags: ["MEAT", "POULTRY"], protein: "POULTRY" }),
  ingredient("beef-mince", "Rinderhackfleisch", "g", MEAT_FISH, [250, 18, 0, 20], 1.1, { tags: ["MEAT", "BEEF"], protein: "MINCE" }),
  ingredient("mixed-mince", "Gemischtes Hackfleisch", "g", MEAT_FISH, [260, 17, 0, 21], 0.9, { tags: ["MEAT", "BEEF", "PORK"], protein: "MINCE" }),
  ingredient("burger-patty", "Burger-Patties (Rind)", "g", MEAT_FISH, [250, 17, 0, 20], 1.4, { tags: ["MEAT", "BEEF"], protein: "BURGER_PATTY" }),
  ingredient("sausage", "Wiener Würstchen", "Stück", MEAT_FISH, [270, 13, 1, 24], 0.35, { tags: ["MEAT", "PORK"], protein: "SAUSAGE", gramsPerPiece: 50 }),
  ingredient("salmon", "Lachsfilet", "g", MEAT_FISH, [200, 20, 0, 13], 2.5, { tags: ["FISH"], protein: "FISH" }),

  // Frozen
  ingredient("spinach-frozen", "Rahmspinat / Blattspinat (TK)", "g", FROZEN, [40, 2.9, 3.6, 1.5], 0.3),
  ingredient("peas-frozen", "Erbsen (TK)", "g", FROZEN, [81, 5.4, 14, 0.4], 0.35),
  ingredient("green-beans-frozen", "Grüne Bohnen (TK)", "g", FROZEN, [31, 1.8, 7, 0.1], 0.35),
  ingredient("vegetable-mix-frozen", "Gemüsemischung (TK)", "g", FROZEN, [45, 2.5, 7, 0.4], 0.3),
  ingredient("fries-frozen", "Pommes (TK)", "g", FROZEN, [150, 2.5, 23, 5], 0.3, { base: "POTATO" }),
  ingredient("roesti-frozen", "Rösti (TK)", "g", FROZEN, [140, 2, 20, 6], 0.4, { base: "POTATO" }),
  ingredient("potato-pancake-frozen", "Kartoffelpuffer (TK)", "g", FROZEN, [190, 3, 23, 9], 0.45, { base: "POTATO" }),
  ingredient("chicken-nuggets-frozen", "Chicken Dinos / Nuggets (TK)", "g", FROZEN, [250, 14, 18, 13], 1.2, { tags: ["MEAT", "POULTRY", "GLUTEN"], protein: "POULTRY" }),
  ingredient("fish-fingers-frozen", "Fischstäbchen (TK)", "g", FROZEN, [200, 13, 15, 9], 0.9, { tags: ["FISH", "GLUTEN"], protein: "FISH" }),
  ingredient("meatballs-frozen", "Köttbullar (TK)", "g", FROZEN, [220, 13, 10, 15], 1.2, { tags: ["MEAT", "BEEF", "PORK", "GLUTEN", "EGGS"], protein: "MEATBALL" }),
  ingredient("veggie-patty-frozen", "Gemüse-Patties (TK)", "g", FROZEN, [190, 5, 22, 9], 1, { tags: ["GLUTEN"] }),

  // Dry goods
  ingredient("pasta", "Nudeln", "g", DRY, [358, 13, 71, 1.5], 0.2, { tags: ["GLUTEN"], base: "PASTA" }),
  ingredient("lasagne-sheets", "Lasagneplatten", "g", DRY, [360, 13, 72, 1.5], 0.35, { tags: ["GLUTEN"], base: "PASTA" }),
  ingredient("ramen-noodles", "Ramen-Nudeln", "g", DRY, [360, 10, 70, 4], 0.6, { tags: ["GLUTEN"], base: "PASTA" }),
  ingredient("rice", "Reis", "g", DRY, [360, 7, 79, 0.7], 0.25, { base: "RICE" }),
  ingredient("risotto-rice", "Risottoreis", "g", DRY, [350, 7, 78, 0.6], 0.4, { base: "RICE" }),
  ingredient("sushi-rice", "Sushireis", "g", DRY, [357, 6.5, 79, 0.6], 0.45, { base: "RICE" }),
  ingredient("semolina", "Weichweizengrieß", "g", DRY, [360, 11, 73, 1], 0.2, { tags: ["GLUTEN"], base: "GRAIN" }),
  ingredient("flour", "Mehl", "g", DRY, [364, 10, 76, 1], 0.1, { tags: ["GLUTEN"], pantry: true }),
  ingredient("breadcrumbs", "Paniermehl", "g", DRY, [370, 12, 72, 3], 0.3, { tags: ["GLUTEN"], pantry: true }),
  ingredient("red-lentils", "Rote Linsen", "g", DRY, [330, 24, 50, 1.5], 0.35),
  ingredient("kidney-beans", "Kidneybohnen (Dose)", "g", DRY, [90, 6.5, 13, 0.5], 0.25),
  ingredient("corn", "Mais (Dose)", "g", DRY, [86, 3.2, 19, 1.2], 0.35),
  ingredient("passata", "Passierte Tomaten", "g", DRY, [24, 1.3, 4, 0.2], 0.15),
  ingredient("chopped-tomatoes", "Gehackte Tomaten (Dose)", "g", DRY, [20, 1.2, 3, 0.2], 0.15),
  ingredient("tomato-paste", "Tomatenmark", "g", DRY, [80, 4.5, 13, 0.5], 0.5),
  ingredient("coconut-milk", "Kokosmilch", "ml", DRY, [180, 2, 3, 18], 0.45, { tags: ["COCONUT"] }),
  ingredient("pineapple", "Ananas (Dose)", "g", DRY, [60, 0.4, 15, 0.1], 0.35),
  ingredient("applesauce", "Apfelmus", "g", DRY, [80, 0.2, 20, 0.1], 0.3, { tags: ["APPLE"] }),
  ingredient("raisins", "Rosinen", "g", DRY, [299, 3.1, 79, 0.5], 0.6),
  ingredient("nori", "Nori-Algenblätter", "Stück", DRY, [190, 41, 41, 0.3], 0.3, { gramsPerPiece: 2.5 }),
  ingredient("fried-onions", "Röstzwiebeln", "g", DRY, [590, 6, 40, 44], 1, { tags: ["GLUTEN"] }),
  ingredient("potato-mash-flakes", "Kartoffelpüree-Flocken", "g", DRY, [350, 8, 75, 1], 0.6, { base: "POTATO" }),
  ingredient("sugar", "Zucker", "g", DRY, [400, 0, 100, 0], 0.1, { pantry: true }),
  ingredient("vanilla-sugar", "Vanillezucker", "g", DRY, [390, 0, 98, 0], 2, { pantry: true }),

  // Spices, oils and sauces (pantry)
  ingredient("salt", "Salz", "g", SPICES, [0, 0, 0, 0], 0.05, { pantry: true }),
  ingredient("pepper", "Pfeffer", "g", SPICES, [250, 10, 64, 3], 3, { pantry: true }),
  ingredient("paprika-powder", "Paprikapulver", "g", SPICES, [280, 14, 54, 13], 3, { pantry: true }),
  ingredient("curry-powder", "Currypulver (mild)", "g", SPICES, [325, 14, 56, 14], 3, { pantry: true }),
  ingredient("italian-herbs", "Italienische Kräuter", "g", SPICES, [270, 9, 64, 4], 4, { pantry: true }),
  ingredient("vegetable-broth", "Gemüsebrühe (Pulver)", "g", SPICES, [200, 8, 30, 6], 1.5, { tags: ["CELERY"], pantry: true }),
  ingredient("oil", "Öl", "ml", SPICES, [884, 0, 0, 100], 0.4, { pantry: true }),
  ingredient("olive-oil", "Olivenöl", "ml", SPICES, [884, 0, 0, 100], 0.8, { pantry: true }),
  ingredient("vinegar", "Essig", "ml", SPICES, [20, 0, 1, 0], 0.2, { tags: ["SULPHITES"], pantry: true }),
  ingredient("mustard", "Senf", "g", SPICES, [100, 6, 5, 6], 0.3, { tags: ["MUSTARD"], pantry: true }),
  ingredient("ketchup", "Ketchup", "g", SPICES, [110, 1.5, 25, 0.2], 0.3, { pantry: true }),
  ingredient("mayonnaise", "Mayonnaise", "g", SPICES, [680, 1, 3, 75], 0.5, { tags: ["EGGS", "MUSTARD"], pantry: true }),
  ingredient("soy-sauce", "Sojasauce", "ml", SPICES, [60, 8, 6, 0], 0.6, { tags: ["SOY", "GLUTEN"], pantry: true }),
  ingredient("sesame", "Sesam", "g", SPICES, [570, 18, 23, 50], 1.5, { tags: ["SESAME"], pantry: true }),
  ingredient("salad-dressing", "Salatdressing", "ml", SPICES, [300, 1, 10, 28], 0.6, { tags: ["MUSTARD"], pantry: true }),
  ingredient("powdered-sugar", "Puderzucker", "g", SPICES, [400, 0, 100, 0], 0.3, { pantry: true }),
  ingredient("cinnamon-sugar", "Zimtzucker", "g", SPICES, [390, 0, 97, 0], 1, { pantry: true }),
];

/** Catalog ingredients by ID. */
export const CATALOG_INGREDIENTS_BY_ID: ReadonlyMap<string, Ingredient> = new Map(CATALOG_INGREDIENTS.map((entry) => [entry.ingredientId, entry]));
