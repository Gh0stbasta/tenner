/** GET/POST /categories and PUT /categories/{categoryId}: household categories (HOUSEHOLD-ADMIN-002). */

import type { Identity } from "../auth/index.js";
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from "../dto/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { categorySchema, createCategorySchema, parseJsonBody, updateCategorySchema, validate } from "../validators/index.js";

export type ListCategories = (tenantId: string) => Promise<CategoryResponse[]>;
export type CreateCategory = (identity: Identity, request: CreateCategoryRequest) => Promise<CategoryResponse>;
export type UpdateCategory = (identity: Identity, categoryId: string, request: UpdateCategoryRequest) => Promise<CategoryResponse>;

export async function listCategoriesHandler(tenantId: string, listCategories: ListCategories): Promise<ApiResult> {
  return successResponse(200, await listCategories(tenantId));
}

export async function createCategoryHandler(event: ApiEvent, identity: Identity, createCategory: CreateCategory, logger: Logger): Promise<ApiResult> {
  const request = validate(createCategorySchema, parseJsonBody(event.body, event.isBase64Encoded));
  const category = await createCategory(identity, request);
  logger.info("Category created", { event: "CategoryCreated", categoryId: category.categoryId, createdBy: identity.userId });
  return successResponse(201, category);
}

export async function updateCategoryHandler(event: ApiEvent, identity: Identity, updateCategory: UpdateCategory, logger: Logger): Promise<ApiResult> {
  const categoryId = validate(categorySchema, event.pathParameters?.categoryId);
  const request = validate(updateCategorySchema, parseJsonBody(event.body, event.isBase64Encoded));
  const category = await updateCategory(identity, categoryId, request);
  logger.info("Category updated", { event: "CategoryUpdated", categoryId, changedFields: Object.keys(request), updatedBy: identity.userId });
  return successResponse(200, category);
}
