/** Tenner list, dates and API calls for voice completion (ALEXA-004). */

import type { TennerApi } from "./tennerApi.js";

export interface TennerSummary {
  readonly tennerId: string;
  readonly title: string;
  readonly assignedTo: string;
  readonly assignmentMode: "FIXED" | "ROTATING";
  readonly estimatedMinutes: number;
  readonly nextDue: string;
  readonly pausedAt: string | null;
  readonly active: boolean;
}

/** Active, non-archived Tenners of the household (GET /tenners defaults), sorted by next due date. */
export function fetchTenners(api: TennerApi): Promise<TennerSummary[]> {
  return api.request<TennerSummary[]>("GET", "/tenners");
}

export interface CompleteResult {
  readonly tenner: TennerSummary;
  readonly completion: { readonly completedBy: string };
}

/** POST /tenners/{id}/complete; the Alexa request ID makes retries of the same request safe. */
export function completeTenner(api: TennerApi, tennerId: string, completedBy: string, idempotencyKey: string): Promise<CompleteResult> {
  return api.request<CompleteResult>("POST", `/tenners/${encodeURIComponent(tennerId)}/complete`, { completedBy }, { "idempotency-key": idempotencyKey });
}

export function undoCompletion(api: TennerApi, tennerId: string, idempotencyKey: string): Promise<{ readonly tenner: TennerSummary }> {
  return api.request("POST", `/tenners/${encodeURIComponent(tennerId)}/undo-completion`, {}, { "idempotency-key": idempotencyKey });
}

export interface HistoryItem {
  readonly tennerId: string;
  readonly tennerTitle: string | null;
  readonly completedBy: string;
  readonly completedAt: string;
}

/** The latest not-undone completion (of one member, or of the household). */
export async function latestCompletion(api: TennerApi, completedBy: string | undefined): Promise<HistoryItem | undefined> {
  const query = completedBy === undefined ? "limit=1" : `limit=1&completedBy=${encodeURIComponent(completedBy)}`;
  return (await api.request<{ items: HistoryItem[] }>("GET", `/history?${query}`)).items[0];
}

/** YYYY-MM-DD of `instant` in `timeZone`. */
export function dateIn(timeZone: string, instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** „12. Oktober“ for a YYYY-MM-DD date. */
export function spokenDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
