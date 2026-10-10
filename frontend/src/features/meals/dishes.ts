/**
 * Dishes (FOOD-010): the household's dish list, editor helpers and API hooks over FOOD-002 and FOOD-021. The
 * derived values (vegetarian, tags, protein sources, base ingredients) mirror the backend's deriveDish, so the
 * editor can show them before saving; the server stays the source of truth.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { dishCostSchema, nutritionEstimateSchema, type Eater, type FoodProfile, type Ingredient } from "./api";
import { MEAL_SLOT_LABELS, TAG_LABELS, type IngredientTag, type MealSlot, type ProteinTag } from "./labels";

export const DISH_CATEGORIES = [
  "PASTA",
  "POTATO",
  "RICE",
  "BURGER_WRAP",
  "MEAT_FISH",
  "VEGETARIAN",
  "SALAD",
  "SOUP",
  "SWEET",
  "SNACK",
] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

export const DISH_CATEGORY_LABELS: Readonly<Record<DishCategory, string>> = {
  PASTA: "Nudeln",
  POTATO: "Kartoffeln",
  RICE: "Reis",
  BURGER_WRAP: "Burger & Wraps",
  MEAT_FISH: "Fleisch & Fisch",
  VEGETARIAN: "Vegetarisch",
  SALAD: "Salat",
  SOUP: "Suppe & Eintopf",
  SWEET: "Süßes",
  SNACK: "Snack & Brotzeit",
};

export const BASE_TAG_LABELS = {
  PASTA: "Nudeln",
  GNOCCHI: "Gnocchi",
  SCHUPFNUDELN: "Schupfnudeln",
  RICE: "Reis",
  POTATO: "Kartoffeln",
  BREAD: "Brot",
  GRAIN: "Getreide",
} as const;
export type BaseTag = keyof typeof BASE_TAG_LABELS;

export const QUANTITY_UNITS = ["g", "ml", "Stück", "EL", "TL"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** Same limits as the backend (backend/src/meals/validators.ts). */
export const DISH_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  ingredientsMax: 30,
  quantityMax: 5000,
  activeMinutesMax: 240,
  totalMinutesMax: 600,
  variantMax: 80,
  groupMax: 60,
  kcalMax: 3000,
  macroMax: 500,
} as const;

/** Tags that make a dish non-vegetarian (backend NON_VEGETARIAN_TAGS). */
const NON_VEGETARIAN_TAGS: readonly string[] = ["MEAT", "POULTRY", "FISH"];

const dishIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number(),
  unit: z.enum(QUANTITY_UNITS),
  optional: z.boolean(),
});
export type DishIngredient = z.infer<typeof dishIngredientSchema>;

export const dishSchema = z.object({
  dishId: z.string(),
  name: z.string(),
  group: z.string().optional(),
  category: z.enum(DISH_CATEGORIES),
  slots: z.array(z.enum(["LUNCH", "DINNER"])),
  lightness: z.enum(["LIGHT", "FILLING"]),
  temperature: z.enum(["WARM", "COLD"]),
  ingredients: z.array(dishIngredientSchema),
  activeMinutes: z.number(),
  totalMinutes: z.number(),
  vegetarianVariant: z.string().optional(),
  familyFriendly: z.boolean(),
  isBurger: z.boolean(),
  favorite: z.boolean(),
  imageKey: z.string().optional(),
  nutrition: nutritionEstimateSchema.optional(),
  cost: dishCostSchema.optional(),
  nutritionOverride: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }).optional(),
  archived: z.boolean(),
  isVegetarian: z.boolean(),
  tags: z.array(z.string()),
  optionalTags: z.array(z.string()),
  proteinSources: z.array(z.string()),
  baseTags: z.array(z.string()),
  unknownIngredients: z.array(z.string()),
  updatedAt: z.string(),
});
export type Dish = z.infer<typeof dishSchema>;

/** What the editor sends (create and update; update sends the whole editable state). */
export interface DishInput {
  readonly name: string;
  readonly group: string | null;
  readonly category: DishCategory;
  readonly slots: readonly MealSlot[];
  readonly lightness: "LIGHT" | "FILLING";
  readonly temperature: "WARM" | "COLD";
  readonly ingredients: readonly DishIngredient[];
  readonly activeMinutes: number;
  readonly totalMinutes: number;
  readonly vegetarianVariant: string | null;
  readonly familyFriendly: boolean;
  readonly isBurger: boolean;
  /** FOOD-012: own values per adult portion instead of the estimate; null = estimate from the ingredients. */
  readonly nutritionOverride: PortionNutrition | null;
}

export interface PortionNutrition {
  readonly kcal: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export interface NewIngredientInput {
  readonly name: string;
  readonly unit: "g" | "ml" | "Stück";
  readonly gramsPerPiece?: number;
  readonly tags: readonly IngredientTag[];
  readonly shoppingSection: string;
}

// API

const dishListSchema = z.object({ dishes: z.array(dishSchema) });

/** Active dishes, or the archived ones. */
export function useDishes(archived: boolean) {
  return useQuery({
    queryKey: [...queryKeys.meals, "dishes", archived ? "archived" : "active"],
    queryFn: async () => (await apiClient.get("/meals/dishes", { schema: dishListSchema, query: { archived } })).dishes,
    staleTime: 60_000,
  });
}

/** A changed dish changes plans, options and the shopping list. */
function useInvalidateMeals() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.meals }),
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans }),
    ]);
}

export function useSaveDish() {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: ({ dishId, input }: { readonly dishId: string | null; readonly input: DishInput }) =>
      dishId === null
        ? apiClient.post("/meals/dishes", { schema: dishSchema, body: withoutEmpty(input, false) })
        : apiClient.put(`/meals/dishes/${encodeURIComponent(dishId)}`, {
            schema: dishSchema,
            body: withoutEmpty(input, true),
          }),
    onSettled: invalidate,
  });
}

/** Archive (DELETE) or restore. */
export function useArchiveDish() {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: ({ dishId, archived }: { readonly dishId: string; readonly archived: boolean }) =>
      archived
        ? apiClient.delete(`/meals/dishes/${encodeURIComponent(dishId)}`, { schema: dishSchema })
        : apiClient.post(`/meals/dishes/${encodeURIComponent(dishId)}/restore`, { schema: dishSchema }),
    onSettled: invalidate,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewIngredientInput) =>
      apiClient.post("/meals/ingredients", {
        schema: z
          .object({ ingredientId: z.string(), name: z.string(), unit: z.enum(["g", "ml", "Stück"]) })
          .passthrough(),
        body: input,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.mealIngredients }),
  });
}

/** Create leaves out empty optional fields; update sends null to remove them. */
function withoutEmpty(input: DishInput, update: boolean): Record<string, unknown> {
  if (update) return { ...input };
  const { group, vegetarianVariant, nutritionOverride, ...rest } = input;
  return {
    ...rest,
    ...(group === null ? {} : { group }),
    ...(vegetarianVariant === null ? {} : { vegetarianVariant }),
    ...(nutritionOverride === null ? {} : { nutritionOverride }),
  };
}

// Pure helpers

/** Units a dish may use for an ingredient: its own unit; spoons for g and ml. */
export function unitsFor(ingredient: Pick<Ingredient, "unit">): QuantityUnit[] {
  return ingredient.unit === "Stück" ? ["Stück"] : [ingredient.unit, "EL", "TL"];
}

export interface DerivedDraft {
  readonly isVegetarian: boolean;
  readonly tags: readonly string[];
  readonly optionalTags: readonly string[];
  readonly proteinSources: readonly string[];
  readonly baseTags: readonly string[];
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** Derived values of a draft (mirror of the backend's deriveDish without overrides). */
export function deriveDraft(entries: readonly DishIngredient[], catalog: readonly Ingredient[]): DerivedDraft {
  const byId = new Map(catalog.map((ingredient) => [ingredient.ingredientId, ingredient]));
  const resolved = entries.map((entry) => ({ entry, ingredient: byId.get(entry.ingredientId) }));
  const required = resolved.flatMap(({ entry, ingredient }) => (!entry.optional && ingredient ? [ingredient] : []));
  const optional = resolved.flatMap(({ entry, ingredient }) => (entry.optional && ingredient ? [ingredient] : []));
  const tags = unique(required.flatMap((ingredient) => ingredient.tags));
  return {
    isVegetarian: !tags.some((tag) => NON_VEGETARIAN_TAGS.includes(tag)),
    tags,
    optionalTags: unique(optional.flatMap((ingredient) => ingredient.tags)).filter((tag) => !tags.includes(tag)),
    proteinSources: unique(required.flatMap((ingredient) => (ingredient.proteinTag ? [ingredient.proteinTag] : []))),
    baseTags: unique(required.flatMap((ingredient) => (ingredient.baseTag ? [ingredient.baseTag] : []))),
  };
}

export interface RuleHint {
  readonly severity: "error" | "warning" | "info";
  readonly text: string;
}

const tagText = (tags: readonly string[]): string =>
  tags.map((tag) => TAG_LABELS[tag as IngredientTag] ?? tag).join(", ");

/** Whether a vegetarian eater can eat it (rule R2, same as the backend). */
function suitsVegetarian(eater: Eater, derived: DerivedDraft, vegetarianVariant: string | null): boolean {
  if (derived.isVegetarian || vegetarianVariant) return true;
  return (
    derived.proteinSources.length > 0 &&
    derived.proteinSources.every((source) => eater.vegetarianExceptions.includes(source as ProteinTag))
  );
}

/**
 * Which rules and eaters the dish affects (FOOD-005): allergies (R1) and diet (R2) exclude it for an eater, dislikes
 * (R3), the cooking time (R4), poultry meals (R5), light weekday lunches (R9) and family-friendliness (R13) limit
 * where the planner uses it.
 */
export function ruleHints(
  draft: Pick<
    DishInput,
    "ingredients" | "activeMinutes" | "vegetarianVariant" | "familyFriendly" | "slots" | "lightness"
  >,
  derived: DerivedDraft,
  profile: Pick<FoodProfile, "eaters" | "household"> | undefined,
): RuleHint[] {
  const hints: RuleHint[] = [];
  const requiredIds = draft.ingredients.filter((entry) => !entry.optional).map((entry) => entry.ingredientId);
  const contains = (tags: readonly string[], ingredientIds: readonly string[]): string[] => [
    ...derived.tags.filter((tag) => tags.includes(tag)).map((tag) => TAG_LABELS[tag as IngredientTag] ?? tag),
    ...(requiredIds.some((id) => ingredientIds.includes(id)) ? ["eine Zutat, die nicht gemocht wird"] : []),
  ];
  for (const eater of profile?.eaters ?? []) {
    const allergies = derived.tags.filter((tag) => eater.allergies.includes(tag as IngredientTag));
    if (allergies.length > 0)
      hints.push({ severity: "error", text: `Nicht für ${eater.name}: Allergie (${tagText(allergies)}).` });
    if (eater.diet === "VEGETARIAN" && !suitsVegetarian(eater, derived, draft.vegetarianVariant)) {
      hints.push({
        severity: "error",
        text: `Nicht für ${eater.name}: nicht vegetarisch und keine vegetarische Variante.`,
      });
    }
    const disliked = contains(eater.dislikeTags, eater.dislikeIngredients);
    if (disliked.length > 0)
      hints.push({
        severity: "warning",
        text: `${eater.name} mag es nicht (${disliked.join(", ")}): wird nicht geplant, wenn ${eater.name} mitisst.`,
      });
  }
  const household = profile?.household;
  if (household) {
    const disliked = contains(household.dislikeTags, household.dislikeIngredients);
    if (disliked.length > 0)
      hints.push({
        severity: "error",
        text: `Enthält etwas, das ihr nicht esst (${disliked.join(", ")}): wird nie geplant.`,
      });
    if (draft.activeMinutes > household.maxActiveMinutes) {
      hints.push({
        severity: "error",
        text: `${draft.activeMinutes} Minuten aktive Kochzeit, erlaubt sind ${household.maxActiveMinutes}: wird nie geplant.`,
      });
    }
    if (derived.tags.includes("POULTRY") || derived.proteinSources.includes("POULTRY")) {
      hints.push({
        severity: "info",
        text: `Hühnchen: nur zu den Mahlzeiten, die ihr dafür erlaubt habt, höchstens ${household.chicken.maxPerWeek}× pro Woche.`,
      });
    }
    if (household.lightLunchOnWeekdays && draft.slots.includes("LUNCH") && draft.lightness === "FILLING") {
      hints.push({
        severity: "info",
        text: `Sättigend: mittags nur am Wochenende (unter der Woche gibt es mittags Leichtes).`,
      });
    }
  }
  if (!draft.familyFriendly) hints.push({ severity: "error", text: "Nicht familientauglich: wird nicht geplant." });
  return hints;
}

export interface DraftErrors {
  readonly [field: string]: string | undefined;
}

/** Field errors before sending (same rules as the backend); empty when the draft can be saved. */
export function validateDraft(draft: DishInput): DraftErrors {
  const errors: Record<string, string> = {};
  const name = draft.name.trim();
  if (name.length < DISH_LIMITS.nameMin) errors.name = `Bitte mindestens ${DISH_LIMITS.nameMin} Zeichen.`;
  else if (name.length > DISH_LIMITS.nameMax) errors.name = `Höchstens ${DISH_LIMITS.nameMax} Zeichen.`;
  if ((draft.group ?? "").length > DISH_LIMITS.groupMax) errors.group = `Höchstens ${DISH_LIMITS.groupMax} Zeichen.`;
  if (draft.slots.length === 0) errors.slots = "Bitte Mittag, Abend oder beides wählen.";
  if (draft.ingredients.length === 0) errors.ingredients = "Bitte mindestens eine Zutat hinzufügen.";
  else if (draft.ingredients.length > DISH_LIMITS.ingredientsMax)
    errors.ingredients = `Höchstens ${DISH_LIMITS.ingredientsMax} Zutaten.`;
  draft.ingredients.forEach((entry, index) => {
    if (!(entry.quantity > 0 && entry.quantity <= DISH_LIMITS.quantityMax))
      errors[`ingredients.${index}.quantity`] = `Menge zwischen 0 und ${DISH_LIMITS.quantityMax}.`;
  });
  if (
    !Number.isInteger(draft.activeMinutes) ||
    draft.activeMinutes < 1 ||
    draft.activeMinutes > DISH_LIMITS.activeMinutesMax
  ) {
    errors.activeMinutes = `Ganze Minuten zwischen 1 und ${DISH_LIMITS.activeMinutesMax}.`;
  }
  if (
    !Number.isInteger(draft.totalMinutes) ||
    draft.totalMinutes < 1 ||
    draft.totalMinutes > DISH_LIMITS.totalMinutesMax
  ) {
    errors.totalMinutes = `Ganze Minuten zwischen 1 und ${DISH_LIMITS.totalMinutesMax}.`;
  } else if (draft.totalMinutes < draft.activeMinutes)
    errors.totalMinutes = "Die Gesamtzeit darf nicht kürzer als die aktive Zeit sein.";
  if ((draft.vegetarianVariant ?? "").length > DISH_LIMITS.variantMax)
    errors.vegetarianVariant = `Höchstens ${DISH_LIMITS.variantMax} Zeichen.`;
  if (draft.nutritionOverride) {
    const { kcal, ...macros } = draft.nutritionOverride;
    if (!(kcal >= 0 && kcal <= DISH_LIMITS.kcalMax))
      errors["nutritionOverride.kcal"] = `Zwischen 0 und ${DISH_LIMITS.kcalMax}.`;
    for (const [field, value] of Object.entries(macros)) {
      if (!(value >= 0 && value <= DISH_LIMITS.macroMax))
        errors[`nutritionOverride.${field}`] = `Zwischen 0 und ${DISH_LIMITS.macroMax}.`;
    }
  }
  return errors;
}

export interface DishFilter {
  readonly search: string;
  readonly slot: MealSlot | "ALL";
  readonly vegetarianOnly: boolean;
  readonly category: DishCategory | "ALL";
}

export function filterDishes(dishes: readonly Dish[], filter: DishFilter): Dish[] {
  const search = filter.search.trim().toLocaleLowerCase("de");
  return dishes.filter(
    (dish) =>
      (search === "" ||
        dish.name.toLocaleLowerCase("de").includes(search) ||
        (dish.group ?? "").toLocaleLowerCase("de").includes(search)) &&
      (filter.slot === "ALL" || dish.slots.includes(filter.slot)) &&
      (!filter.vegetarianOnly || dish.isVegetarian || dish.vegetarianVariant !== undefined) &&
      (filter.category === "ALL" || dish.category === filter.category),
  );
}

/** „Mittag, Abend · 25 Min. aktiv (45 Min. gesamt)“ */
export function dishSummaryLine(dish: Pick<Dish, "slots" | "activeMinutes" | "totalMinutes">): string {
  const time =
    dish.totalMinutes > dish.activeMinutes
      ? `${dish.activeMinutes} Min. aktiv (${dish.totalMinutes} Min. gesamt)`
      : `${dish.activeMinutes} Min.`;
  return `${dish.slots.map((slot) => MEAL_SLOT_LABELS[slot]).join(", ")} · ${time}`;
}
