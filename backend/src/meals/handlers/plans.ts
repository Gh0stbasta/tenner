/** GET /meals/plans/{weekStart} (FOOD-006): `current`, `next` or a week start date (YYYY-MM-DD). */

import { z } from "zod";
import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { MealPlanResponse } from "../models/plan.js";
import type { ReplaceMealRequest } from "../services/meal-plan.service.js";

export type GetMealPlan = (tenantId: string, week: string) => Promise<MealPlanResponse>;
export type ReplaceMeal = (identity: Identity, week: string, slotId: string, request: ReplaceMealRequest) => Promise<MealPlanResponse>;

export const weekReferenceSchema = z.union([z.literal("current"), z.literal("next"), z.iso.date()]);

export const weekOf = (event: ApiEvent): string => validate(weekReferenceSchema, event.pathParameters?.weekStart);

export async function getMealPlanHandler(event: ApiEvent, tenantId: string, getPlan: GetMealPlan): Promise<ApiResult> {
  return successResponse(200, await getPlan(tenantId, weekOf(event)));
}

export const slotIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}#(LUNCH|DINNER)$/, "Invalid meal.");

const dishRefSchema = z.string().min(1).max(64);

const replaceMealSchema = z
  .object({
    excludeDishIds: z.array(dishRefSchema).max(100).optional(),
    dishId: dishRefSchema.optional(),
  })
  .strict();

function decoded(value: string | undefined): string | undefined {
  try {
    return value === undefined ? undefined : decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Path parameter slotId (`2026-10-14#DINNER`); clients send `#` as `%23`, decoded here if API Gateway did not. */
export const slotOf = (event: ApiEvent): string => validate(slotIdSchema, decoded(event.pathParameters?.slotId));

const bodyOf = (event: ApiEvent): unknown => (event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded));

export async function replaceMealHandler(event: ApiEvent, identity: Identity, replaceMeal: ReplaceMeal, logger: Logger): Promise<ApiResult> {
  const week = weekOf(event);
  const slotId = slotOf(event);
  const request = validate(replaceMealSchema, bodyOf(event));
  const plan = await replaceMeal(identity, week, slotId, request.dishId === undefined ? { ...(request.excludeDishIds ? { excludeDishIds: request.excludeDishIds } : {}) } : { dishId: request.dishId });
  logger.info("Meal replaced", { event: "MealReplaced", weekStart: plan.weekStart, slotId, undo: request.dishId !== undefined, updatedBy: identity.userId });
  return successResponse(200, plan);
}
