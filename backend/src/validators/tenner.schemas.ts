import { z } from "zod";
import {
  TENNER_SORT_FIELDS,
  type CompleteTennerRequest,
  type DashboardRequest,
  type CreateTennerRequest,
  type ListTennersRequest,
  type RestoreTennerRequest,
  type UndoCompletionRequest,
  type UpdateTennerRequest,
} from "../dto/index.js";
import {
  actualMinutesSchema,
  booleanFlagSchema,
  categorySchema,
  estimatedMinutesSchema,
  isoDateSchema,
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

/** Optional Idempotency-Key header: 1-128 printable characters without spaces. */
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/, "Invalid Idempotency-Key header.");

/** Undo request (TICKET-014): reason is trimmed; whitespace-only and > 250 characters are rejected. */
export const undoCompletionSchema = z.strictObject({
  revertedBy: userIdSchema,
  reason: z.string().trim().min(1, "Reason must not be blank.").max(250).optional(),
}) satisfies z.ZodType<UndoCompletionRequest>;

export const restoreTennerSchema = z.strictObject({ restoredBy: userIdSchema }) satisfies z.ZodType<RestoreTennerRequest>;

/** Query string of GET /dashboard (TICKET-016). Dates must be real calendar dates (2026-02-30 is rejected). */
export const dashboardQuerySchema = z.strictObject({
  assignedTo: userIdSchema.optional(),
  category: categorySchema.optional(),
  date: isoDateSchema.optional(),
}) satisfies z.ZodType<DashboardRequest, Record<string, string | undefined>>;
