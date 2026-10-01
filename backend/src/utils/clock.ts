/** Injectable time and ID sources, so services stay deterministic in tests. */

import { randomUUID } from "node:crypto";

export type Clock = () => Date;
export type IdGenerator = () => string;

export const systemClock: Clock = () => new Date();
export const uuidGenerator: IdGenerator = () => randomUUID();

/** ISO 8601 UTC timestamp without milliseconds, e.g. 2026-10-01T18:30:00Z. */
export function toUtcTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** UTC calendar date (YYYY-MM-DD). Household timezone support follows in SCHEDULING-008. */
export function toUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
