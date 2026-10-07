/** Meal planning API (release 2.0): ingredients (FOOD-021) and the family food profile (FOOD-004). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { INGREDIENT_TAGS, PROTEIN_TAGS, WEEK_SLOTS, type WeekSlot } from "./labels";

const ingredientSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  unit: z.enum(["g", "ml", "Stück"]),
  tags: z.array(z.string()),
  proteinTag: z.string().optional(),
  baseTag: z.string().optional(),
  shoppingSection: z.string(),
  pricePerUnit: z.number(),
  pantry: z.boolean(),
  source: z.enum(["CATALOG", "CUSTOM"]),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export function useIngredients() {
  return useQuery({
    queryKey: queryKeys.mealIngredients,
    queryFn: async () =>
      (await apiClient.get("/meals/ingredients", { schema: z.object({ ingredients: z.array(ingredientSchema) }) }))
        .ingredients,
    staleTime: 10 * 60_000,
  });
}

const tagSchema = z.enum(INGREDIENT_TAGS);
const proteinSchema = z.enum(PROTEIN_TAGS);
const weekSlotSchema = z.enum(WEEK_SLOTS as [WeekSlot, ...WeekSlot[]]);

const eaterSchema = z.object({
  eaterId: z.string(),
  name: z.string(),
  type: z.enum(["ADULT", "CHILD"]),
  memberId: z.string().optional(),
  portionFactor: z.number(),
  diet: z.enum(["OMNIVORE", "VEGETARIAN"]),
  vegetarianExceptions: z.array(proteinSchema),
  allergies: z.array(tagSchema),
  dislikeTags: z.array(tagSchema),
  dislikeIngredients: z.array(z.string()),
  likeIngredients: z.array(z.string()),
  likeGroups: z.array(z.string()),
});
export type Eater = z.infer<typeof eaterSchema>;

const attendanceList = z.array(z.string()).nullable();
const householdRulesSchema = z.object({
  dislikeTags: z.array(tagSchema),
  dislikeIngredients: z.array(z.string()),
  maxActiveMinutes: z.number(),
  attendance: z.object({ weekdayLunch: attendanceList, weekendLunch: attendanceList, dinner: attendanceList }),
  lightLunchOnWeekdays: z.boolean(),
  maxSaladLunchesPerWeek: z.number(),
  chicken: z.object({ maxPerWeek: z.number(), allowedSlots: z.array(weekSlotSchema) }),
  maxBurgerPerWeek: z.number(),
  limitedProteinTags: z.array(proteinSchema),
  mealTimes: z.object({ lunch: z.string(), dinner: z.string() }),
});
export type HouseholdFoodRules = z.infer<typeof householdRulesSchema>;
export type Attendance = HouseholdFoodRules["attendance"];

const profileSchema = z.object({
  eaters: z.array(eaterSchema),
  household: householdRulesSchema,
  updatedAt: z.string().nullable(),
});
export type FoodProfile = z.infer<typeof profileSchema>;
export interface FoodProfileUpdate {
  readonly eaters: readonly Eater[];
  readonly household: HouseholdFoodRules;
}

export function useFoodProfile() {
  return useQuery({
    queryKey: queryKeys.mealProfile,
    queryFn: () => apiClient.get("/meals/profile", { schema: profileSchema }),
    staleTime: 5 * 60_000,
  });
}

export function useSaveFoodProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: FoodProfileUpdate) =>
      apiClient.put("/meals/profile", { schema: profileSchema, body: profile }),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.mealProfile, saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.mealProfile }),
  });
}

const WEEKDAY_LUNCH_DEFAULT = (eaters: readonly Eater[]) => eaters.filter((eater) => eater.type === "ADULT");

/** Eaters of a meal kind, with the defaults the backend applies when nothing is configured (decision 5). */
export function attendingEaters(eaters: readonly Eater[], attendance: Attendance, meal: keyof Attendance): Eater[] {
  const configured = attendance[meal];
  if (configured !== null) return eaters.filter((eater) => configured.includes(eater.eaterId));
  return meal === "weekdayLunch" ? WEEKDAY_LUNCH_DEFAULT(eaters) : [...eaters];
}
