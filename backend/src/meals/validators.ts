/** Request schemas of the meal planning API (release 2.0). */

import { z } from "zod";
import { DISH_CATEGORIES, LIGHTNESS, MEAL_SLOTS, TEMPERATURES } from "./models/dish.js";
import { IMAGE_CONTENT_TYPES, IMAGE_LIMITS } from "./models/image.js";
import { DIETS, EATER_TYPES, WEEK_SLOTS, type WeekSlot } from "./models/profile.js";
import { USER_ID_PATTERN } from "../models/index.js";
import { BASE_TAGS, INGREDIENT_ID_PATTERN, INGREDIENT_TAGS, INGREDIENT_UNITS, PROTEIN_TAGS, QUANTITY_UNITS, SHOPPING_SECTIONS } from "./models/ingredient.js";

export const MEAL_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  gramsPerPieceMax: 5000,
  priceMax: 100,
  nutritionMax: 1000,
  dishIngredientsMax: 30,
  quantityMax: 5000,
  activeMinutesMax: 240,
  totalMinutesMax: 600,
  variantMax: 80,
  groupMax: 60,
  costMax: 500,
} as const;

export const mealNameSchema = z.string().trim().min(MEAL_LIMITS.nameMin).max(MEAL_LIMITS.nameMax);
export const ingredientIdSchema = z.string().max(80).regex(INGREDIENT_ID_PATTERN, "Invalid ingredient ID.");

const tagsSchema = z
  .array(z.enum(INGREDIENT_TAGS))
  .max(INGREDIENT_TAGS.length)
  .refine((tags) => new Set(tags).size === tags.length, "Tags must be distinct.");

const nutritionValue = z.number().min(0).max(MEAL_LIMITS.nutritionMax);
const nutritionSchema = z.object({ kcal: nutritionValue, protein: nutritionValue, carbs: nutritionValue, fat: nutritionValue }).strict();
/** FOOD-012: a dish's own values per adult portion (a portion can exceed 1000 kcal). */
const portionNutritionSchema = z
  .object({ kcal: z.number().min(0).max(3000), protein: z.number().min(0).max(500), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(500) })
  .strict();

/** Fields every member may change on an ingredient (FOOD-021); the unit is fixed once created. */
const editableIngredientFields = {
  name: mealNameSchema,
  tags: tagsSchema,
  proteinTag: z.enum(PROTEIN_TAGS).nullable(),
  baseTag: z.enum(BASE_TAGS).nullable(),
  shoppingSection: z.enum(SHOPPING_SECTIONS),
  nutritionPer100g: nutritionSchema,
  pricePerUnit: z.number().min(0).max(MEAL_LIMITS.priceMax),
  pantry: z.boolean(),
  gramsPerPiece: z.number().positive().max(MEAL_LIMITS.gramsPerPieceMax),
};

export const createIngredientSchema = z
  .object({
    name: editableIngredientFields.name,
    unit: z.enum(INGREDIENT_UNITS),
    tags: editableIngredientFields.tags.default([]),
    proteinTag: editableIngredientFields.proteinTag.optional(),
    baseTag: editableIngredientFields.baseTag.optional(),
    shoppingSection: editableIngredientFields.shoppingSection.default("SONSTIGES"),
    nutritionPer100g: editableIngredientFields.nutritionPer100g.default({ kcal: 0, protein: 0, carbs: 0, fat: 0 }),
    pricePerUnit: editableIngredientFields.pricePerUnit.default(0),
    pantry: editableIngredientFields.pantry.default(false),
    gramsPerPiece: editableIngredientFields.gramsPerPiece.optional(),
  })
  .strict()
  .refine((request) => request.unit !== "Stück" || request.gramsPerPiece !== undefined, { message: "Pieces need a weight per piece.", path: ["gramsPerPiece"] });

export type CreateIngredientRequest = z.output<typeof createIngredientSchema>;

export const updateIngredientSchema = z
  .object({
    name: editableIngredientFields.name.optional(),
    tags: editableIngredientFields.tags.optional(),
    proteinTag: editableIngredientFields.proteinTag.optional(),
    baseTag: editableIngredientFields.baseTag.optional(),
    shoppingSection: editableIngredientFields.shoppingSection.optional(),
    nutritionPer100g: editableIngredientFields.nutritionPer100g.optional(),
    pricePerUnit: editableIngredientFields.pricePerUnit.optional(),
    pantry: editableIngredientFields.pantry.optional(),
    gramsPerPiece: editableIngredientFields.gramsPerPiece.optional(),
  })
  .strict()
  .refine((request) => Object.keys(request).length > 0, "At least one field is required.");

export type UpdateIngredientRequest = z.output<typeof updateIngredientSchema>;

const distinct = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

export const dishIdSchema = z.uuid("Invalid dish ID.");

const dishIngredientSchema = z
  .object({
    ingredientId: ingredientIdSchema,
    quantity: z.number().positive().max(MEAL_LIMITS.quantityMax),
    unit: z.enum(QUANTITY_UNITS),
    optional: z.boolean().default(false),
  })
  .strict();

const dishFields = {
  name: mealNameSchema,
  group: z.string().trim().min(1).max(MEAL_LIMITS.groupMax).nullable(),
  category: z.enum(DISH_CATEGORIES),
  slots: z.array(z.enum(MEAL_SLOTS)).min(1).max(MEAL_SLOTS.length).refine(distinct, "Slots must be distinct."),
  lightness: z.enum(LIGHTNESS),
  temperature: z.enum(TEMPERATURES),
  ingredients: z
    .array(dishIngredientSchema)
    .min(1)
    .max(MEAL_LIMITS.dishIngredientsMax)
    .refine((entries) => distinct(entries.map((entry) => entry.ingredientId)), "Each ingredient only once."),
  activeMinutes: z.number().int().min(1).max(MEAL_LIMITS.activeMinutesMax),
  totalMinutes: z.number().int().min(1).max(MEAL_LIMITS.totalMinutesMax),
  vegetarianVariant: z.string().trim().min(1).max(MEAL_LIMITS.variantMax).nullable(),
  familyFriendly: z.boolean(),
  isBurger: z.boolean(),
  proteinSourcesOverride: z.array(z.enum(PROTEIN_TAGS)).max(PROTEIN_TAGS.length).refine(distinct, "Protein sources must be distinct.").nullable(),
  baseTagsOverride: z.array(z.enum(BASE_TAGS)).max(BASE_TAGS.length).refine(distinct, "Base ingredients must be distinct.").nullable(),
  nutritionOverride: portionNutritionSchema.nullable(),
  costOverride: z.number().min(0).max(MEAL_LIMITS.costMax).nullable(),
  favorite: z.boolean(),
};

const totalNotBelowActive = (request: { activeMinutes?: number | undefined; totalMinutes?: number | undefined }): boolean =>
  request.activeMinutes === undefined || request.totalMinutes === undefined || request.totalMinutes >= request.activeMinutes;

export const createDishSchema = z
  .object({
    name: dishFields.name,
    group: dishFields.group.optional(),
    category: dishFields.category,
    slots: dishFields.slots,
    lightness: dishFields.lightness,
    temperature: dishFields.temperature,
    ingredients: dishFields.ingredients,
    activeMinutes: dishFields.activeMinutes,
    totalMinutes: dishFields.totalMinutes.optional(),
    vegetarianVariant: dishFields.vegetarianVariant.optional(),
    familyFriendly: dishFields.familyFriendly.default(true),
    isBurger: dishFields.isBurger.default(false),
    proteinSourcesOverride: dishFields.proteinSourcesOverride.optional(),
    baseTagsOverride: dishFields.baseTagsOverride.optional(),
    nutritionOverride: dishFields.nutritionOverride.optional(),
    costOverride: dishFields.costOverride.optional(),
    favorite: dishFields.favorite.default(false),
  })
  .strict()
  .refine(totalNotBelowActive, { message: "Total time must not be below the active time.", path: ["totalMinutes"] });

export type CreateDishRequest = z.output<typeof createDishSchema>;

export const updateDishSchema = z
  .object(Object.fromEntries(Object.entries(dishFields).map(([key, schema]) => [key, schema.optional()])) as { [K in keyof typeof dishFields]: z.ZodOptional<(typeof dishFields)[K]> })
  .strict()
  .refine((request) => Object.keys(request).length > 0, "At least one field is required.")
  .refine(totalNotBelowActive, { message: "Total time must not be below the active time.", path: ["totalMinutes"] });

export type UpdateDishRequest = z.output<typeof updateDishSchema>;

/** FOOD-011: request for a presigned photo upload. */
export const imageUploadSchema = z
  .object({
    contentType: z.enum(IMAGE_CONTENT_TYPES),
    size: z.number().int().min(1).max(IMAGE_LIMITS.maxBytes),
  })
  .strict();

export type ImageUploadRequest = z.output<typeof imageUploadSchema>;

/** FOOD-011: attach an uploaded photo (the key from the upload response). */
export const dishImageSchema = z.object({ imageKey: z.string().min(1).max(200) }).strict();

export type DishImageRequest = z.output<typeof dishImageSchema>;

export const listDishesQuerySchema = z
  .object({
    archived: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
    slot: z.enum(MEAL_SLOTS).optional(),
  })
  .strict();

export type ListDishesQuery = z.output<typeof listDishesQuerySchema>;

const ingredientRefs = z.array(ingredientIdSchema).max(100).refine(distinct, "Entries must be distinct.");
const groupRefs = z.array(z.string().trim().min(1).max(MEAL_LIMITS.groupMax)).max(50).refine(distinct, "Entries must be distinct.");
const eaterIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,40}$/, "Invalid eater ID.");
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM.");

const eaterSchema = z
  .object({
    eaterId: eaterIdSchema.optional(),
    name: z.string().trim().min(1).max(40),
    type: z.enum(EATER_TYPES),
    memberId: z.string().regex(USER_ID_PATTERN, "Invalid household member ID.").optional(),
    portionFactor: z.number().min(0.1).max(2).optional(),
    diet: z.enum(DIETS).default("OMNIVORE"),
    vegetarianExceptions: z.array(z.enum(PROTEIN_TAGS)).max(PROTEIN_TAGS.length).refine(distinct, "Entries must be distinct.").default([]),
    allergies: tagsSchema.default([]),
    dislikeTags: tagsSchema.default([]),
    dislikeIngredients: ingredientRefs.default([]),
    likeIngredients: ingredientRefs.default([]),
    likeGroups: groupRefs.default([]),
  })
  .strict();

const attendanceList = z.array(eaterIdSchema).max(20).refine(distinct, "Entries must be distinct.").nullable();

export const foodProfileSchema = z
  .object({
    eaters: z.array(eaterSchema).max(20),
    household: z
      .object({
        dislikeTags: tagsSchema,
        dislikeIngredients: ingredientRefs,
        maxActiveMinutes: z.number().int().min(5).max(MEAL_LIMITS.activeMinutesMax),
        attendance: z.object({ weekdayLunch: attendanceList, weekendLunch: attendanceList, dinner: attendanceList }).strict(),
        lightLunchOnWeekdays: z.boolean(),
        lightLunchMaxKcal: z.number().int().min(200).max(2000).default(600),
        maxSaladLunchesPerWeek: z.number().int().min(0).max(7),
        chicken: z
          .object({
            maxPerWeek: z.number().int().min(0).max(14),
            allowedSlots: z
              .array(z.enum(WEEK_SLOTS as [WeekSlot, ...WeekSlot[]]))
              .max(WEEK_SLOTS.length)
              .refine(distinct, "Entries must be distinct."),
          })
          .strict(),
        maxBurgerPerWeek: z.number().int().min(0).max(14),
        limitedProteinTags: z.array(z.enum(PROTEIN_TAGS)).max(PROTEIN_TAGS.length).refine(distinct, "Entries must be distinct."),
        mealTimes: z.object({ lunch: timeOfDaySchema, dinner: timeOfDaySchema }).strict(),
      })
      .strict(),
  })
  .strict();

export type FoodProfileRequest = z.output<typeof foodProfileSchema>;
