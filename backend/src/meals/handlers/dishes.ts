/** /meals/dishes routes (FOOD-002). */

import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { DishResponse } from "../models/dish.js";
import { createDishSchema, dishIdSchema, listDishesQuerySchema, updateDishSchema, type CreateDishRequest, type ListDishesQuery, type UpdateDishRequest } from "../validators.js";

export type ListDishes = (tenantId: string, query: ListDishesQuery) => Promise<DishResponse[]>;
export type GetDish = (tenantId: string, dishId: string) => Promise<DishResponse>;
export type CreateDish = (identity: Identity, request: CreateDishRequest) => Promise<DishResponse>;
export type UpdateDish = (identity: Identity, dishId: string, request: UpdateDishRequest) => Promise<DishResponse>;
export type ArchiveDish = (identity: Identity, dishId: string) => Promise<DishResponse>;

const dishIdOf = (event: ApiEvent): string => validate(dishIdSchema, event.pathParameters?.dishId);

export async function listDishesHandler(event: ApiEvent, tenantId: string, listDishes: ListDishes): Promise<ApiResult> {
  const query = validate(listDishesQuerySchema, event.queryStringParameters ?? {});
  return successResponse(200, { dishes: await listDishes(tenantId, query) });
}

export async function getDishHandler(event: ApiEvent, tenantId: string, getDish: GetDish): Promise<ApiResult> {
  return successResponse(200, await getDish(tenantId, dishIdOf(event)));
}

export async function createDishHandler(event: ApiEvent, identity: Identity, createDish: CreateDish, logger: Logger): Promise<ApiResult> {
  const request = validate(createDishSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const dish = await createDish(identity, request);
  logger.info("Dish created", { event: "DishCreated", dishId: dish.dishId, createdBy: identity.userId });
  return successResponse(201, dish);
}

export async function updateDishHandler(event: ApiEvent, identity: Identity, updateDish: UpdateDish, logger: Logger): Promise<ApiResult> {
  const dishId = dishIdOf(event);
  const request = validate(updateDishSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const dish = await updateDish(identity, dishId, request);
  logger.info("Dish updated", { event: "DishUpdated", dishId, changedFields: Object.keys(request), updatedBy: identity.userId });
  return successResponse(200, dish);
}

export async function archiveDishHandler(event: ApiEvent, identity: Identity, archiveDish: ArchiveDish, logger: Logger): Promise<ApiResult> {
  const dishId = dishIdOf(event);
  const dish = await archiveDish(identity, dishId);
  logger.info("Dish archived", { event: "DishArchived", dishId, updatedBy: identity.userId });
  return successResponse(200, dish);
}

export async function restoreDishHandler(event: ApiEvent, identity: Identity, restoreDish: ArchiveDish, logger: Logger): Promise<ApiResult> {
  const dishId = dishIdOf(event);
  const dish = await restoreDish(identity, dishId);
  logger.info("Dish restored", { event: "DishRestored", dishId, updatedBy: identity.userId });
  return successResponse(200, dish);
}
