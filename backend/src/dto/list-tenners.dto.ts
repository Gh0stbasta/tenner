/** GET /tenners contracts (TICKET-010). */

import type { Category, UserId } from "../models/index.js";
import type { TennerResponse } from "./tenner.dto.js";

export const TENNER_SORT_FIELDS = ["nextDue", "title", "createdAt", "updatedAt"] as const;
export type TennerSortField = (typeof TENNER_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

/** Validated query parameters. Boolean flags only filter when true (active also when false). */
export interface ListTennersRequest {
  readonly assignedTo?: UserId | undefined;
  readonly category?: Category | undefined;
  /** Default: true (only active Tenners). */
  readonly active?: boolean | undefined;
  /** true: nextDue <= today. */
  readonly due?: boolean | undefined;
  /** true: nextDue < today. */
  readonly overdue?: boolean | undefined;
  /** Default: nextDue. */
  readonly sort?: TennerSortField | undefined;
  /** Default: asc. */
  readonly order?: SortOrder | undefined;
}

export type ListTennersResponse = TennerResponse[];
