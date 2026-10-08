/** API contracts for Tenners. Requests are produced by validators (see validators/). */

import { startDateOf, type AssignmentMode, type Category, type FrequencyUnit, type Tenner, type UserId, type Weekday } from "../models/index.js";

/**
 * Validated create request. The frequency is normalized by the validator (SCHEDULING-001): clients send either
 * `frequencyDays` (→ DAY, interval = days) or `frequencyUnit` + `frequencyInterval` (→ derived frequencyDays).
 */
export interface CreateTennerRequest {
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
  readonly frequencyUnit: FrequencyUnit;
  readonly frequencyInterval: number;
  /** WEEK only (SCHEDULING-002); null for every other frequency. */
  readonly weekdays: readonly Weekday[] | null;
  readonly assignedTo: UserId;
  /** HOUSEHOLD-001: normalized by the validator (FIXED + null by default). */
  readonly assignmentMode: AssignmentMode;
  readonly rotation: readonly UserId[] | null;
  /** HOTFIX-006: first active day (YYYY-MM-DD); default today. The Tenner is first due on that day. */
  readonly startDate?: string | undefined;
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
  readonly frequencyUnit: FrequencyUnit;
  readonly frequencyInterval: number;
  readonly weekdays: readonly Weekday[] | null;
  readonly assignedTo: UserId;
  readonly assignmentMode: AssignmentMode;
  readonly rotation: readonly UserId[] | null;
  /** Member the Tenner is covered for during a handover (HOUSEHOLD-004), or null. */
  readonly originalAssignee: UserId | null;
  readonly lastCompleted: string | null;
  readonly nextDue: string;
  /** HOTFIX-006: first active day; the creation date for Tenners created before. */
  readonly startDate: string;
  readonly snoozedUntil: string | null;
  /** Individual pause (SCHEDULING-005); a vacation pause is derived from GET /household. */
  readonly pausedAt: string | null;
  readonly pausedUntil: string | null;
  readonly active: boolean;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** SECURITY-004 audit fields; null for records written before authentication. */
  readonly createdBy: UserId | null;
  readonly updatedBy: UserId | null;
}

/** DELETE /tenners/{tennerId} response (TICKET-012). */
export interface DeleteTennerResponse {
  readonly tennerId: string;
  readonly deleted: true;
}

/** POST /tenners/{tennerId}/restore (TICKET-015). */
export interface RestoreTennerRequest {
  /** Optional; must match the authenticated user if given (SECURITY-004). */
  readonly restoredBy?: UserId | undefined;
}

export interface RestoreTennerResponse {
  readonly tennerId: string;
  readonly active: boolean;
  readonly deletedAt: string | null;
}

export function toTennerResponse(tenner: Tenner): TennerResponse {
  return {
    tennerId: tenner.tennerId,
    title: tenner.title,
    category: tenner.category,
    estimatedMinutes: tenner.estimatedMinutes,
    frequencyDays: tenner.frequencyDays,
    frequencyUnit: tenner.frequencyUnit,
    frequencyInterval: tenner.frequencyInterval,
    weekdays: tenner.weekdays,
    assignedTo: tenner.assignedTo,
    assignmentMode: tenner.assignmentMode,
    rotation: tenner.rotation,
    originalAssignee: tenner.originalAssignee,
    lastCompleted: tenner.lastCompleted,
    nextDue: tenner.nextDue,
    startDate: startDateOf(tenner),
    snoozedUntil: tenner.snoozedUntil,
    pausedAt: tenner.pausedAt,
    pausedUntil: tenner.pausedUntil,
    active: tenner.active,
    deletedAt: tenner.deletedAt,
    createdAt: tenner.createdAt,
    updatedAt: tenner.updatedAt,
    createdBy: tenner.createdBy,
    updatedBy: tenner.updatedBy,
  };
}

/** POST /tenners/{tennerId}/pause (SCHEDULING-005): until = last paused day; omitted = until resumed. */
export interface PauseTennerRequest {
  readonly until?: string | undefined;
}
