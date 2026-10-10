/** Meal planning API (release 2.0): ingredients (FOOD-021) and the family food profile (FOOD-004). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { config } from "../../config";
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
  /** FOOD-012 (default for profiles saved before). */
  lightLunchMaxKcal: z.number().default(600),
  /** FOOD-013 (default for profiles saved before). */
  costTiers: z.object({ cheapMax: z.number(), mediumMax: z.number() }).default({ cheapMax: 6, mediumMax: 10 }),
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
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mealProfile }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans }),
      ]),
  });
}

const WEEKDAY_LUNCH_DEFAULT = (eaters: readonly Eater[]) => eaters.filter((eater) => eater.type === "ADULT");

/** Eaters of a meal kind, with the defaults the backend applies when nothing is configured (decision 5). */
export function attendingEaters(eaters: readonly Eater[], attendance: Attendance, meal: keyof Attendance): Eater[] {
  const configured = attendance[meal];
  if (configured !== null) return eaters.filter((eater) => configured.includes(eater.eaterId));
  return meal === "weekdayLunch" ? WEEKDAY_LUNCH_DEFAULT(eaters) : [...eaters];
}

const mealCatalogImportSchema = z.object({
  dryRun: z.boolean(),
  dishesCreated: z.array(z.string()),
  dishesSkipped: z.array(z.string()),
});
export type MealCatalogImport = z.infer<typeof mealCatalogImportSchema>;

function importMealCatalog(dryRun: boolean): Promise<MealCatalogImport> {
  return apiClient.post("/meals/catalog", { schema: mealCatalogImportSchema, body: { dryRun } });
}

/** Dry run of the dish catalog import (FOOD-003). */
export function useMealCatalogPreview() {
  return useMutation({ mutationFn: () => importMealCatalog(true) });
}

/** The dish catalog import; afterwards every meal query is reloaded. */
export function useImportMealCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importMealCatalog(false),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.meals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans }),
      ]),
  });
}

/** Nutrition estimate per adult portion (FOOD-012). */
export const nutritionEstimateSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  source: z.enum(["INGREDIENTS", "OVERRIDE"]),
  complete: z.boolean(),
});
export type NutritionEstimate = z.infer<typeof nutritionEstimateSchema>;

/** Cost estimate (FOOD-013): EUR per adult portion plus pantry, or the family's own amount. */
export const dishCostSchema = z.object({
  perAdultPortion: z.number().nullable(),
  pantry: z.number(),
  familyOverride: z.number().nullable(),
  source: z.enum(["INGREDIENTS", "OVERRIDE"]),
  complete: z.boolean(),
});
export type DishCost = z.infer<typeof dishCostSchema>;

// Weekly plans (FOOD-006, FOOD-009)

const dishSummarySchema = z.object({
  dishId: z.string(),
  name: z.string(),
  category: z.string(),
  lightness: z.enum(["LIGHT", "FILLING"]),
  temperature: z.enum(["WARM", "COLD"]),
  activeMinutes: z.number(),
  totalMinutes: z.number(),
  isVegetarian: z.boolean(),
  vegetarianVariant: z.string().optional(),
  imageKey: z.string().optional(),
  /** Optional: plans cached offline before FOOD-012 have none. */
  nutrition: nutritionEstimateSchema.optional(),
  cost: dishCostSchema.optional(),
  favorite: z.boolean(),
  archived: z.boolean(),
});
export type DishSummary = z.infer<typeof dishSummarySchema>;

const planSlotSchema = z.object({
  slotId: z.string(),
  date: z.string(),
  weekday: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  slot: z.enum(["LUNCH", "DINNER"]),
  dishId: z.string().nullable(),
  locked: z.boolean(),
  source: z.enum(["AUTO", "MANUAL"]),
  status: z.enum(["PLANNED", "COOKED", "SKIPPED", "OTHER"]),
  emptyReason: z.string().optional(),
  dish: dishSummarySchema.nullable(),
  /** FOOD-013: EUR for the eaters of this meal. */
  cost: z.number().nullable().optional(),
  /** FOOD-023: 👍 / 👎 of the household for a cooked meal. */
  feedback: z.enum(["UP", "DOWN"]).optional(),
});
export type PlanSlot = z.infer<typeof planSlotSchema>;

const violationSchema = z.object({
  rule: z.string(),
  severity: z.enum(["HARD", "SOFT"]),
  slotIds: z.array(z.string()),
  message: z.string(),
});
export type Violation = z.infer<typeof violationSchema>;

export const mealPlanSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  ready: z.boolean(),
  setup: z.object({ hasDishes: z.boolean(), hasEaters: z.boolean() }),
  generatedAt: z.string().nullable(),
  slots: z.array(planSlotSchema),
  violations: z.array(violationSchema),
  /** FOOD-013; optional for plans cached offline before. */
  cost: z
    .object({ total: z.number(), perMeal: z.number().nullable(), meals: z.number(), complete: z.boolean() })
    .optional(),
});
export type MealPlan = z.infer<typeof mealPlanSchema>;

export type WeekChoice = "current" | "next";

export function useMealPlan(week: WeekChoice, enabled = true) {
  return useQuery({
    queryKey: queryKeys.mealPlan(week),
    queryFn: () => apiClient.get(`/meals/plans/${week}`, { schema: mealPlanSchema }),
    staleTime: 60_000,
    enabled,
  });
}

/** A plan change returns the whole plan: it replaces the cached week. */
function usePlanChange<TVariables>(week: WeekChoice, change: (variables: TVariables) => Promise<MealPlan>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (plan) => queryClient.setQueryData(queryKeys.mealPlan(week), plan),
  });
}

const slotPath = (week: WeekChoice, slotId: string) => `/meals/plans/${week}/slots/${encodeURIComponent(slotId)}`;

export interface ReplaceMealVariables {
  readonly slotId: string;
  readonly excludeDishIds?: readonly string[];
  /** Put this dish back (undo). */
  readonly dishId?: string;
}

/** „Anderes Gericht“ and its undo (FOOD-007). */
export function useReplaceMeal(week: WeekChoice) {
  return usePlanChange(week, ({ slotId, ...body }: ReplaceMealVariables) =>
    apiClient.post(`${slotPath(week, slotId)}/replace`, { schema: mealPlanSchema, body }),
  );
}

const mealOptionSchema = z.object({ dish: dishSummarySchema, violations: z.array(violationSchema) });
export type MealOption = z.infer<typeof mealOptionSchema>;
const mealOptionsSchema = z.object({ options: z.array(mealOptionSchema) });

/** Dishes for one meal, those that fit all rules first (FOOD-022); loaded when the picker opens. */
export function useMealOptions(week: WeekChoice, slotId: string | null) {
  return useQuery({
    queryKey: queryKeys.mealOptions(week, slotId ?? ""),
    queryFn: async () =>
      (await apiClient.get(`${slotPath(week, slotId ?? "")}/options`, { schema: mealOptionsSchema })).options,
    enabled: slotId !== null,
    staleTime: 0,
  });
}

export interface ChooseMealVariables {
  readonly slotId: string;
  readonly dishId?: string;
  readonly locked?: boolean;
  /** Needed for allergy and vegetarian conflicts (409 CONFIRMATION_REQUIRED otherwise). */
  readonly confirm?: boolean;
}

/** „Selbst wählen“ and „Festlegen“ (FOOD-022). */
export function useChooseMeal(week: WeekChoice) {
  return usePlanChange(week, ({ slotId, ...body }: ChooseMealVariables) =>
    apiClient.put(slotPath(week, slotId), { schema: mealPlanSchema, body }),
  );
}

export interface MealStatusVariables {
  readonly slotId: string;
  readonly status: PlanSlot["status"];
  readonly feedback?: "UP" | "DOWN";
}

/** „Gekocht“ / „Ausgefallen“ / „Anderes gegessen“ and 👍 / 👎 (FOOD-023). */
export function useSetMealStatus(week: WeekChoice) {
  return usePlanChange(week, ({ slotId, ...body }: MealStatusVariables) =>
    apiClient.put(`${slotPath(week, slotId)}/status`, { schema: mealPlanSchema, body }),
  );
}

export interface SwapMealsVariables {
  readonly from: string;
  readonly to: string;
  readonly confirm?: boolean;
}

/** „Tauschen“ (FOOD-022). */
export function useSwapMeals(week: WeekChoice) {
  return usePlanChange(week, (body: SwapMealsVariables) =>
    apiClient.post(`/meals/plans/${week}/swap`, { schema: mealPlanSchema, body }),
  );
}

const regeneratedPlanSchema = mealPlanSchema.extend({
  regeneration: z.object({ changed: z.number(), kept: z.number() }),
});
export type RegeneratedPlan = z.infer<typeof regeneratedPlanSchema>;

export interface RegenerateWeekVariables {
  /** Undo: the previous dishes of the replanned meals. */
  readonly restore?: readonly { readonly slotId: string; readonly dishId: string | null }[];
}

/** „Woche neu planen“ and its undo (FOOD-008). */
export function useRegenerateWeek(week: WeekChoice) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegenerateWeekVariables) =>
      apiClient.post(`/meals/plans/${week}/regenerate`, { schema: regeneratedPlanSchema, body }),
    onSuccess: (result) => queryClient.setQueryData(queryKeys.mealPlan(week), mealPlanSchema.parse(result)),
  });
}

const shoppingItemSchema = z.object({
  key: z.string(),
  ingredientId: z.string().nullable(),
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.enum(["g", "ml", "Stück"]).nullable(),
  section: z.enum([
    "GEMUESE_OBST",
    "BACKWAREN",
    "KUEHLREGAL",
    "FLEISCH_FISCH",
    "TIEFKUEHL",
    "TROCKENWAREN",
    "GEWUERZE",
    "SONSTIGES",
  ]),
  pantry: z.boolean(),
  checked: z.boolean(),
  manual: z.boolean(),
  usedFor: z.array(z.string()),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingListSchema = z.object({
  weekStart: z.string(),
  range: z.enum(["REST", "WEEK"]),
  generatedAt: z.string(),
  stale: z.boolean(),
  items: z.array(shoppingItemSchema),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;
export type ShoppingRange = ShoppingList["range"];

export type ShoppingOperation =
  | { readonly type: "check"; readonly key: string; readonly checked: boolean }
  | { readonly type: "add"; readonly key: string; readonly name: string }
  | { readonly type: "remove"; readonly key: string }
  | { readonly type: "move"; readonly key: string; readonly afterKey: string | null };

const shoppingPath = (week: string) => `/meals/plans/${week}/shopping-list`;

/** The week's list (FOOD-014); kept in the offline cache, so it is readable in the shop without a connection. */
export function useShoppingList(week: WeekChoice, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shoppingList(week),
    queryFn: () => apiClient.get(shoppingPath(week), { schema: shoppingListSchema }),
    staleTime: 30_000,
    enabled,
  });
}

/** „Liste aktualisieren“ and the range switch. */
export function useRefreshShoppingList(week: WeekChoice) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (range?: ShoppingRange) =>
      apiClient.post(`${shoppingPath(week)}/refresh`, {
        schema: shoppingListSchema,
        body: range ? { range } : {},
      }),
    onSuccess: (list) => queryClient.setQueryData(queryKeys.shoppingList(week), list),
  });
}

/** Sends queued changes for one list (by its week start, so a queue survives the change of week). */
export const sendShoppingOperations = (weekStart: string, operations: readonly ShoppingOperation[]) =>
  apiClient.post(`${shoppingPath(weekStart)}/changes`, { schema: shoppingListSchema, body: { operations } });

/** FOOD-013: change an ingredient's price (catalog ingredients keep it as a household override). */
export function useUpdateIngredientPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ingredientId, pricePerUnit }: { readonly ingredientId: string; readonly pricePerUnit: number }) =>
      apiClient.put(`/meals/ingredients/${encodeURIComponent(ingredientId)}`, {
        schema: ingredientSchema,
        body: { pricePerUnit },
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.meals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans }),
      ]),
  });
}

// Calendar subscription (FOOD-015)

const calendarStatusSchema = z.object({ active: z.boolean(), createdAt: z.string().nullable() });
export type CalendarStatus = z.infer<typeof calendarStatusSchema>;
const calendarKey = [...queryKeys.meals, "calendar"] as const;

export function useCalendarStatus() {
  return useQuery({
    queryKey: calendarKey,
    queryFn: () => apiClient.get("/meals/calendar", { schema: calendarStatusSchema }),
  });
}

export function useCreateCalendarToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post("/meals/calendar", { schema: z.object({ token: z.string(), createdAt: z.string() }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

export function useRevokeCalendarToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete("/meals/calendar", { schema: calendarStatusSchema }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: calendarKey }),
  });
}

/** Feed URL for a token; `webcal:` opens Apple Calendar directly. */
export function calendarUrls(token: string, apiBaseUrl: string = config.apiBaseUrl): { https: string; webcal: string } {
  const https = `${apiBaseUrl}/meals/calendar/${token}.ics`;
  return { https, webcal: https.replace(/^https:/, "webcal:") };
}

// Meal history (FOOD-023)

const dishHistorySchema = z.object({
  dishes: z.array(
    z.object({
      dishId: z.string(),
      lastEaten: z.string().nullable(),
      timesLast90Days: z.number(),
      feedback: z.enum(["UP", "DOWN"]).nullable(),
    }),
  ),
});
export type DishHistoryEntry = z.infer<typeof dishHistorySchema>["dishes"][number];

export function useDishHistory() {
  return useQuery({
    queryKey: [...queryKeys.meals, "history"],
    queryFn: async () =>
      new Map(
        (await apiClient.get("/meals/history", { schema: dishHistorySchema })).dishes.map((entry) => [
          entry.dishId,
          entry,
        ]),
      ),
    staleTime: 5 * 60_000,
  });
}

// Food analytics (FOOD-019)

export const FOOD_PERIODS = ["4w", "12w", "1y"] as const;
export type FoodPeriod = (typeof FOOD_PERIODS)[number];

const foodAnalyticsSchema = z.object({
  period: z.enum(FOOD_PERIODS),
  from: z.string(),
  to: z.string(),
  meals: z.number(),
  protein: z.array(z.object({ tag: z.string(), count: z.number() })),
  vegetarianShare: z.number().nullable(),
  favorites: z.array(
    z.object({ dishId: z.string(), name: z.string(), count: z.number(), feedback: z.enum(["UP", "DOWN"]).nullable() }),
  ),
  rarelyEaten: z.array(z.object({ dishId: z.string(), name: z.string() })),
  cost: z.object({
    total: z.number(),
    perMeal: z.number().nullable(),
    weeks: z.array(z.object({ weekStart: z.string(), total: z.number() })),
  }),
  variety: z.object({
    distinctDishes: z.number(),
    meals: z.number(),
    repeats: z.array(z.object({ dishId: z.string(), name: z.string(), count: z.number() })),
  }),
  adherence: z.object({ asPlanned: z.number(), replaced: z.number(), skipped: z.number(), other: z.number() }),
});
export type FoodAnalytics = z.infer<typeof foodAnalyticsSchema>;

export function useFoodAnalytics(period: FoodPeriod) {
  return useQuery({
    queryKey: [...queryKeys.meals, "analytics", period],
    queryFn: () => apiClient.get("/meals/analytics", { schema: foodAnalyticsSchema, query: { period } }),
    staleTime: 5 * 60_000,
  });
}
