/** Dishes and ingredients for the dish editor tests (FOOD-010). */

import type { Eater, FoodProfile, Ingredient } from "../features/meals/api";
import { DEFAULT_FOOD_RULES } from "./fetchMock";
import type { Dish } from "../features/meals/dishes";

const ingredient = (fields: Partial<Ingredient> & Pick<Ingredient, "ingredientId" | "name">): Ingredient => ({
  unit: "g",
  tags: [],
  shoppingSection: "SONSTIGES",
  pricePerUnit: 0.01,
  pantry: false,
  source: "CATALOG",
  ...fields,
});

export const SPAGHETTI = ingredient({ ingredientId: "i-pasta", name: "Spaghetti", tags: ["GLUTEN"], baseTag: "PASTA" });
export const MINCE = ingredient({
  ingredientId: "i-mince",
  name: "Hackfleisch",
  tags: ["MEAT", "BEEF"],
  proteinTag: "MINCE",
});
export const WALNUTS = ingredient({ ingredientId: "i-nuts", name: "Walnüsse", tags: ["NUTS"] });
export const EGG = ingredient({ ingredientId: "i-egg", name: "Ei", unit: "Stück", tags: ["EGGS"] });
export const CHICKEN = ingredient({
  ingredientId: "i-chicken",
  name: "Hähnchenbrust",
  tags: ["MEAT", "POULTRY"],
  proteinTag: "POULTRY",
});
export const TOFU = ingredient({ ingredientId: "i-tofu", name: "Tofu", tags: ["TOFU", "SOY"] });
export const INGREDIENTS = [SPAGHETTI, MINCE, WALNUTS, EGG, CHICKEN, TOFU];

export function dish(fields: Partial<Dish> = {}): Dish {
  return {
    dishId: "d-1",
    name: "Spaghetti Bolognese",
    group: "Bolognese",
    category: "PASTA",
    slots: ["LUNCH", "DINNER"],
    lightness: "FILLING",
    temperature: "WARM",
    ingredients: [
      { ingredientId: "i-pasta", quantity: 125, unit: "g", optional: false },
      { ingredientId: "i-mince", quantity: 100, unit: "g", optional: false },
    ],
    activeMinutes: 20,
    totalMinutes: 40,
    familyFriendly: true,
    isBurger: false,
    favorite: false,
    archived: false,
    isVegetarian: false,
    tags: ["GLUTEN", "MEAT", "BEEF"],
    optionalTags: [],
    proteinSources: ["MINCE"],
    baseTags: ["PASTA"],
    unknownIngredients: [],
    updatedAt: "2026-10-08T10:00:00Z",
    ...fields,
  };
}

/** Two eaters: one with a nut allergy, one vegetarian who eats minced meat (FOOD-004). */
export const ADULT_1: Eater = {
  eaterId: "a1",
  name: "Erwachsener 1",
  type: "ADULT",
  portionFactor: 1,
  diet: "OMNIVORE",
  vegetarianExceptions: [],
  allergies: ["NUTS"],
  dislikeTags: [],
  dislikeIngredients: [],
  likeIngredients: [],
  likeGroups: [],
};
export const ADULT_2: Eater = {
  ...ADULT_1,
  eaterId: "a2",
  name: "Erwachsener 2",
  diet: "VEGETARIAN",
  vegetarianExceptions: ["MINCE"],
  allergies: [],
  dislikeIngredients: ["i-egg"],
};

export const FAMILY = {
  eaters: [ADULT_1, ADULT_2],
  household: DEFAULT_FOOD_RULES,
  updatedAt: "2026-10-07T10:00:00Z",
} as FoodProfile;
