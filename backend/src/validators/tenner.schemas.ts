import { z } from "zod";
import type { CompleteTennerRequest, CreateTennerRequest, UpdateTennerRequest } from "../dto/index.js";
import {
  actualMinutesSchema,
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

export const updateTennerSchema = createTennerSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." }) satisfies z.ZodType<UpdateTennerRequest>;

export const completeTennerSchema = z.strictObject({
  completedBy: userIdSchema,
  actualMinutes: actualMinutesSchema.optional(),
  completedAt: utcTimestampSchema.optional(),
}) satisfies z.ZodType<CompleteTennerRequest>;
