/** GET/POST /meals/ingredients and PUT /meals/ingredients/{ingredientId} (FOOD-021). */

import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { ResolvedIngredient } from "../models/ingredient.js";
import { createIngredientSchema, ingredientIdSchema, updateIngredientSchema, type CreateIngredientRequest, type UpdateIngredientRequest } from "../validators.js";

export type ListIngredients = (tenantId: string) => Promise<ResolvedIngredient[]>;
export type CreateIngredient = (identity: Identity, request: CreateIngredientRequest) => Promise<ResolvedIngredient>;
export type UpdateIngredient = (identity: Identity, ingredientId: string, request: UpdateIngredientRequest) => Promise<ResolvedIngredient>;

export async function listIngredientsHandler(tenantId: string, listIngredients: ListIngredients): Promise<ApiResult> {
  return successResponse(200, { ingredients: await listIngredients(tenantId) });
}

export async function createIngredientHandler(event: ApiEvent, identity: Identity, createIngredient: CreateIngredient, logger: Logger): Promise<ApiResult> {
  const request = validate(createIngredientSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const ingredient = await createIngredient(identity, request);
  logger.info("Ingredient created", { event: "IngredientCreated", ingredientId: ingredient.ingredientId, createdBy: identity.userId });
  return successResponse(201, ingredient);
}

export async function updateIngredientHandler(event: ApiEvent, identity: Identity, updateIngredient: UpdateIngredient, logger: Logger): Promise<ApiResult> {
  const ingredientId = validate(ingredientIdSchema, event.pathParameters?.ingredientId);
  const request = validate(updateIngredientSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const ingredient = await updateIngredient(identity, ingredientId, request);
  logger.info("Ingredient updated", { event: "IngredientUpdated", ingredientId, changedFields: Object.keys(request), updatedBy: identity.userId });
  return successResponse(200, ingredient);
}
