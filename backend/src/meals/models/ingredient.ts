/**
 * Ingredients (FOOD-021): the shared reference list of allergy checks, protein and base rules, shopping list,
 * nutrition and cost. Catalog ingredients live in code (catalog/ingredients.ts); the household adds its own or
 * overrides catalog values (stored as INGREDIENT#<id>).
 */

/** Base unit of an ingredient: nutrition per 100 g (ml counts as g), price per 100 g / 100 ml or per piece. */
export const INGREDIENT_UNITS = ["g", "ml", "Stück"] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/** Units a dish may use; EL and TL convert to 15 and 5 g/ml. */
export const QUANTITY_UNITS = [...INGREDIENT_UNITS, "EL", "TL"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

const SPOON_GRAMS: Readonly<Record<"EL" | "TL", number>> = { EL: 15, TL: 5 };

/** EU 14 major allergens plus household tags, diet tags and the owner's dislikes (EPIC-FOOD-001). */
export const INGREDIENT_TAGS = [
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOY",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
  "APPLE",
  "COCONUT",
  "MEAT",
  "POULTRY",
  "PORK",
  "BEEF",
  "TOFU",
  "QUINOA",
  "BLUE_CHEESE",
] as const;
export type IngredientTag = (typeof INGREDIENT_TAGS)[number];

/** Tags that make an ingredient non-vegetarian. */
export const NON_VEGETARIAN_TAGS: readonly IngredientTag[] = ["MEAT", "POULTRY", "FISH"];

/** Animal protein sources of rule R7; beef and pork count by form (EPIC-FOOD-001, decision 3). */
export const PROTEIN_TAGS = ["POULTRY", "FISH", "MINCE", "BURGER_PATTY", "SAUSAGE", "MEATBALL", "HAM"] as const;
export type ProteinTag = (typeof PROTEIN_TAGS)[number];

/** Base ingredients of rule R8; Spätzle are pasta, gnocchi and Schupfnudeln separate (decision 4). */
export const BASE_TAGS = ["PASTA", "GNOCCHI", "SCHUPFNUDELN", "RICE", "POTATO", "BREAD", "GRAIN"] as const;
export type BaseTag = (typeof BASE_TAGS)[number];

/** Shopping list sections in supermarket order (FOOD-014). */
export const SHOPPING_SECTIONS = ["GEMUESE_OBST", "BACKWAREN", "KUEHLREGAL", "FLEISCH_FISCH", "TIEFKUEHL", "TROCKENWAREN", "GEWUERZE", "SONSTIGES"] as const;
export type ShoppingSection = (typeof SHOPPING_SECTIONS)[number];

export interface Nutrition {
  readonly kcal: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export interface Ingredient {
  readonly ingredientId: string;
  readonly name: string;
  readonly unit: IngredientUnit;
  /** Weight of one piece; required for unit "Stück" (nutrition is per 100 g). */
  readonly gramsPerPiece?: number;
  readonly tags: readonly IngredientTag[];
  readonly proteinTag?: ProteinTag;
  readonly baseTag?: BaseTag;
  readonly shoppingSection: ShoppingSection;
  /** Rough values per 100 g (FOOD-012). */
  readonly nutritionPer100g: Nutrition;
  /** EUR estimate per 100 g, 100 ml or piece (FOOD-013). */
  readonly pricePerUnit: number;
  /** Basic supply (salt, oil, spices): collapsed on the shopping list. */
  readonly pantry: boolean;
}

/** An ingredient as the API returns it: catalog or household-specific, possibly with household overrides. */
export interface ResolvedIngredient extends Ingredient {
  readonly source: "CATALOG" | "CUSTOM";
  /** True when the household changed values of a catalog ingredient. */
  readonly overridden: boolean;
}

export const INGREDIENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Quantity of a dish ingredient in the ingredient's base unit; undefined if the units cannot be converted. */
export function toBaseQuantity(quantity: number, unit: QuantityUnit, ingredient: Pick<Ingredient, "unit">): number | undefined {
  if (unit === ingredient.unit) return quantity;
  if ((unit === "EL" || unit === "TL") && ingredient.unit !== "Stück") return quantity * SPOON_GRAMS[unit];
  return undefined;
}

/** Quantity in grams (ml as g, pieces by their weight); undefined if unknown. */
export function toGrams(quantity: number, unit: QuantityUnit, ingredient: Pick<Ingredient, "unit" | "gramsPerPiece">): number | undefined {
  const base = toBaseQuantity(quantity, unit, ingredient);
  if (base === undefined) return undefined;
  if (ingredient.unit !== "Stück") return base;
  return ingredient.gramsPerPiece === undefined ? undefined : base * ingredient.gramsPerPiece;
}

/** Slug for a household ingredient name, e.g. „Rote Bete“ → custom-rote-bete. */
export function customIngredientId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${slug || "zutat"}`;
}
