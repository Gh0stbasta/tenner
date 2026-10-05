/** Reusable field schemas. Limits are centralized here. */

import { z } from "zod";
import { CATEGORY_ICONS, CATEGORY_ID_PATTERN, FREQUENCY_UNITS, MEMBER_COLORS, USER_ID_PATTERN, WEEKDAYS } from "../models/index.js";

export const LIMITS = {
  titleMin: 3,
  titleMax: 100,
  estimatedMinutesMin: 1,
  estimatedMinutesMax: 480,
  frequencyDaysMin: 1,
  frequencyDaysMax: 3650,
  actualMinutesMin: 1,
  actualMinutesMax: 1440,
} as const;

export const titleSchema = z.string().trim().min(LIMITS.titleMin).max(LIMITS.titleMax);
/** Category ID format only; existence and archive state are checked by the services (HOUSEHOLD-ADMIN-002). */
export const categorySchema = z.string().regex(CATEGORY_ID_PATTERN, "Invalid category.");
export const categoryIconSchema = z.enum(CATEGORY_ICONS);
/** Member ID format only; whether the member exists is checked by the services (HOUSEHOLD-ADMIN-001). */
export const userIdSchema = z.string().regex(USER_ID_PATTERN, "Invalid household member ID.");
export const memberColorSchema = z.enum(MEMBER_COLORS);
export const displayNameSchema = z.string().trim().min(1).max(40);
export const estimatedMinutesSchema = z.number().int().min(LIMITS.estimatedMinutesMin).max(LIMITS.estimatedMinutesMax);
export const frequencyDaysSchema = z.number().int().min(LIMITS.frequencyDaysMin).max(LIMITS.frequencyDaysMax);
export const frequencyUnitSchema = z.enum(FREQUENCY_UNITS);
export const frequencyIntervalSchema = z.number().int().min(1).max(LIMITS.frequencyDaysMax);
/** Weekdays (SCHEDULING-002): 1–7 distinct values; normalized to ISO order by the Tenner schemas. */
export const weekdaysSchema = z
  .array(z.enum(WEEKDAYS))
  .min(1)
  .max(WEEKDAYS.length)
  .refine((days) => new Set(days).size === days.length, "Weekdays must be distinct.");
export const actualMinutesSchema = z.number().int().min(LIMITS.actualMinutesMin).max(LIMITS.actualMinutesMax);

/** ISO 8601 UTC timestamp, e.g. 2026-10-01T18:30:00Z (optional fractional seconds). */
export const utcTimestampSchema = z.iso.datetime({ offset: false });

/** Calendar date YYYY-MM-DD (validated as a real date). */
export const isoDateSchema = z.iso.date();

/** Query-string boolean: exactly "true" or "false". */
export const booleanFlagSchema = z.enum(["true", "false"]).transform((value) => value === "true");
