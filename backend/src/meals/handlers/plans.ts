/** GET /meals/plans/{weekStart} (FOOD-006): `current`, `next` or a week start date (YYYY-MM-DD). */

import { z } from "zod";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import { validate } from "../../validators/index.js";
import type { MealPlanResponse } from "../models/plan.js";

export type GetMealPlan = (tenantId: string, week: string) => Promise<MealPlanResponse>;

export const weekReferenceSchema = z.union([z.literal("current"), z.literal("next"), z.iso.date()]);

export const weekOf = (event: ApiEvent): string => validate(weekReferenceSchema, event.pathParameters?.weekStart);

export async function getMealPlanHandler(event: ApiEvent, tenantId: string, getPlan: GetMealPlan): Promise<ApiResult> {
  return successResponse(200, await getPlan(tenantId, weekOf(event)));
}
