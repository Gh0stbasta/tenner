/** Zod schemas for Tenner API payloads. They mirror backend/src/dto. */

import { z } from "zod";
import { FREQUENCY_UNITS, WEEKDAYS } from "../../types/domain";

/** Category IDs are managed data (HOUSEHOLD-ADMIN-002); names come from features/categories. */
export const categorySchema = z.string();
/** Member IDs are managed data (HOUSEHOLD-ADMIN-001); names come from features/members. */
export const userIdSchema = z.string();

export const tennerSchema = z.object({
  tennerId: z.string(),
  title: z.string(),
  category: categorySchema,
  estimatedMinutes: z.number(),
  frequencyDays: z.number(),
  frequencyUnit: z.enum(FREQUENCY_UNITS),
  frequencyInterval: z.number(),
  /** SCHEDULING-002: weekdays for WEEK frequencies, otherwise null. */
  weekdays: z.array(z.enum(WEEKDAYS)).nullable(),
  assignedTo: userIdSchema,
  /** HOUSEHOLD-001: rotating assignment; FIXED for Tenners from before. */
  assignmentMode: z.enum(["FIXED", "ROTATING"]).default("FIXED"),
  rotation: z.array(z.string()).nullable().default(null),
  /** HOUSEHOLD-004: member the Tenner is covered for during a handover. */
  originalAssignee: z.string().nullable().default(null),
  lastCompleted: z.string().nullable(),
  nextDue: z.string(),
  /** HOTFIX-006: first active day; missing in data cached before HOTFIX-006. */
  startDate: z.string().optional(),
  /** SCHEDULING-003: postponed-to date, cleared by the next completion. */
  snoozedUntil: z.string().nullable(),
  /** SCHEDULING-005: individual pause; a vacation pause comes from the household settings. */
  pausedAt: z.string().nullable().default(null),
  pausedUntil: z.string().nullable().default(null),
  active: z.boolean(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Tenner = z.infer<typeof tennerSchema>;

export const completionSchema = z.object({
  completionId: z.string(),
  tennerId: z.string(),
  completedBy: userIdSchema,
  completedAt: z.string(),
  actualMinutes: z.number(),
});
export type Completion = z.infer<typeof completionSchema>;

export const completeTennerResponseSchema = z.object({ tenner: tennerSchema, completion: completionSchema });
export type CompleteTennerResponse = z.infer<typeof completeTennerResponseSchema>;
