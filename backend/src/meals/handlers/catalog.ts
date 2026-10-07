/** POST /meals/catalog (FOOD-003): body empty or `{ "dryRun": true }`. */

import { z } from "zod";
import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { MealCatalogImportResult } from "../services/meal-catalog-import.service.js";

export type ImportMealCatalog = (identity: Identity, dryRun: boolean) => Promise<MealCatalogImportResult>;

const importRequestSchema = z.object({ dryRun: z.boolean().default(false) }).strict();

export async function importMealCatalogHandler(event: ApiEvent, identity: Identity, importCatalog: ImportMealCatalog, logger: Logger): Promise<ApiResult> {
  const body = event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded);
  const { dryRun } = validate(importRequestSchema, body);
  const result = await importCatalog(identity, dryRun);
  if (!dryRun) logger.info("Meal catalog imported", { event: "MealCatalogImported", dishesCreated: result.dishesCreated.length, dishesSkipped: result.dishesSkipped.length, importedBy: identity.userId });
  return successResponse(200, result);
}
