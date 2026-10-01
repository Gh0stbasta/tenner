/** API contracts for Tenners. Requests are produced by validators (see validators/). */

import type { Category, Tenner, UserId } from "../models/index.js";

export interface CreateTennerRequest {
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
  readonly assignedTo: UserId;
}

/**
 * Partial update (TICKET-011): any of the create fields plus `active`; at least one field.
 * tenantId, tennerId, createdAt, lastCompleted and nextDue are protected and rejected.
 */
export type UpdateTennerRequest = { readonly [K in keyof CreateTennerRequest]?: CreateTennerRequest[K] | undefined } & {
  readonly active?: boolean | undefined;
};

export type UpdateTennerResponse = TennerResponse;

/** Public representation of a Tenner. tenantId is internal and never exposed. */
export interface TennerResponse {
  readonly tennerId: string;
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
  readonly assignedTo: UserId;
  readonly lastCompleted: string | null;
  readonly nextDue: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTennerResponse(tenner: Tenner): TennerResponse {
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    category: tenner.category,
    estimatedMinutes: tenner.estimatedMinutes,
    frequencyDays: tenner.frequencyDays,
    assignedTo: tenner.assignedTo,
    lastCompleted: tenner.lastCompleted,
    nextDue: tenner.nextDue,
    active: tenner.active,
    createdAt: tenner.createdAt,
    updatedAt: tenner.updatedAt,
  };
}
