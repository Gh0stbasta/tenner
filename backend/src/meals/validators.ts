/** Request schemas of the meal planning API (release 2.0). */

import { z } from "zod";
import { BASE_TAGS, INGREDIENT_ID_PATTERN, INGREDIENT_TAGS, INGREDIENT_UNITS, PROTEIN_TAGS, SHOPPING_SECTIONS } from "./models/ingredient.js";

export const MEAL_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  gramsPerPieceMax: 5000,
  priceMax: 100,
  nutritionMax: 1000,
} as const;

export const mealNameSchema = z.string().trim().min(MEAL_LIMITS.nameMin).max(MEAL_LIMITS.nameMax);
export const ingredientIdSchema = z.string().max(80).regex(INGREDIENT_ID_PATTERN, "Invalid ingredient ID.");

const tagsSchema = z
  .array(z.enum(INGREDIENT_TAGS))
  .max(INGREDIENT_TAGS.length)
  .refine((tags) => new Set(tags).size === tags.length, "Tags must be distinct.");

const nutritionValue = z.number().min(0).max(MEAL_LIMITS.nutritionMax);
const nutritionSchema = z.object({ kcal: nutritionValue, protein: nutritionValue, carbs: nutritionValue, fat: nutritionValue }).strict();

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
