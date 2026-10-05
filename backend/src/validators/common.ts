/** Reusable field schemas. Limits are centralized here. */

import { z } from "zod";
import { CATEGORIES, FREQUENCY_UNITS, USER_IDS, WEEKDAYS } from "../models/index.js";

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
export const categorySchema = z.enum(CATEGORIES);
export const userIdSchema = z.enum(USER_IDS);
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
