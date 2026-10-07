/** Shopping list routes (FOOD-014): /meals/plans/{weekStart}/shopping-list. */

import { z } from "zod";
import type { Identity } from "../../auth/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import { parseJsonBody, validate } from "../../validators/index.js";
import type { ShoppingListResponse } from "../services/shopping-list.service.js";
import { MANUAL_KEY_PREFIX, SHOPPING_RANGES, type ShoppingOperation, type ShoppingRange } from "../shopping/shopping-list.js";
import { weekOf } from "./plans.js";

export type GetShoppingList = (tenantId: string, week: string) => Promise<ShoppingListResponse>;
export type RefreshShoppingList = (identity: Identity, week: string, range?: ShoppingRange) => Promise<ShoppingListResponse>;
export type ChangeShoppingList = (identity: Identity, week: string, operations: readonly ShoppingOperation[]) => Promise<ShoppingListResponse>;

const itemKeySchema = z.string().min(1).max(80);
const manualKeySchema = z.string().regex(new RegExp(`^${MANUAL_KEY_PREFIX}[A-Za-z0-9-]{1,64}$`), "Invalid item key.");

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("check"), key: itemKeySchema, checked: z.boolean() }).strict(),
  z.object({ type: z.literal("add"), key: manualKeySchema, name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ type: z.literal("remove"), key: itemKeySchema }).strict(),
  z.object({ type: z.literal("move"), key: itemKeySchema, afterKey: itemKeySchema.nullable() }).strict(),
]);

const changeSchema = z.object({ operations: z.array(operationSchema).min(1).max(200) }).strict();
const refreshSchema = z.object({ range: z.enum(SHOPPING_RANGES).optional() }).strict();

const bodyOf = (event: ApiEvent): unknown => (event.body === undefined || event.body === "" ? {} : parseJsonBody(event.body, event.isBase64Encoded));

export async function getShoppingListHandler(event: ApiEvent, tenantId: string, getList: GetShoppingList): Promise<ApiResult> {
  return successResponse(200, await getList(tenantId, weekOf(event)));
}

export async function refreshShoppingListHandler(event: ApiEvent, identity: Identity, refresh: RefreshShoppingList, logger: Logger): Promise<ApiResult> {
  const week = weekOf(event);
  const { range } = validate(refreshSchema, bodyOf(event));
  const list = await refresh(identity, week, range);
  logger.info("Shopping list refreshed", { event: "ShoppingListRefreshed", weekStart: list.weekStart, range: list.range, items: list.items.length, updatedBy: identity.userId });
  return successResponse(200, list);
}

/** POST …/changes: item names are not logged (own items are free text). */
export async function changeShoppingListHandler(event: ApiEvent, identity: Identity, change: ChangeShoppingList, logger: Logger): Promise<ApiResult> {
  const week = weekOf(event);
  const { operations } = validate(changeSchema, bodyOf(event));
  const list = await change(identity, week, operations);
  logger.info("Shopping list changed", { event: "ShoppingListChanged", weekStart: list.weekStart, operations: operations.length, updatedBy: identity.userId });
  return successResponse(200, list);
}
