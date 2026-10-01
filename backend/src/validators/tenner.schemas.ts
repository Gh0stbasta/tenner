import { z } from "zod";
import { TENNER_SORT_FIELDS, type CompleteTennerRequest, type CreateTennerRequest, type ListTennersRequest, type UpdateTennerRequest } from "../dto/index.js";
import {
  actualMinutesSchema,
  booleanFlagSchema,
  categorySchema,
  estimatedMinutesSchema,
  frequencyDaysSchema,
  titleSchema,
  userIdSchema,
  utcTimestampSchema,
} from "./common.js";

export const createTennerSchema = z.strictObject({
  title: titleSchema,
  category: categorySchema,
  estimatedMinutes: estimatedMinutesSchema,
  frequencyDays: frequencyDaysSchema,
  assignedTo: userIdSchema,
}) satisfies z.ZodType<CreateTennerRequest>;

/** Partial update; protected fields (tenantId, tennerId, createdAt, lastCompleted, nextDue) are rejected as unknown keys. */
export const updateTennerSchema = createTennerSchema
  .extend({ active: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." }) satisfies z.ZodType<UpdateTennerRequest>;

export const completeTennerSchema = z.strictObject({
  completedBy: userIdSchema,
  actualMinutes: actualMinutesSchema.optional(),
  completedAt: utcTimestampSchema.optional(),
}) satisfies z.ZodType<CompleteTennerRequest>;

/** Query string of GET /tenners. Unknown parameters are rejected. */
export const listTennersQuerySchema = z.strictObject({
  assignedTo: userIdSchema.optional(),
  category: categorySchema.optional(),
  active: booleanFlagSchema.optional(),
  due: booleanFlagSchema.optional(),
  overdue: booleanFlagSchema.optional(),
  sort: z.enum(TENNER_SORT_FIELDS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
}) satisfies z.ZodType<ListTennersRequest, Record<string, string | undefined>>;

/** Path parameter {tennerId}: UUIDs today; alphanumerics and dashes, 1-64 characters. */
export const tennerIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "Invalid Tenner ID.");
