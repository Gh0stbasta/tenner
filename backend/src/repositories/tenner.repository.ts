import type { Category, Tenner, UserId } from "../models/index.js";

/**
 * Data-level selection criteria. All criteria are combined with AND; omitted criteria do not filter.
 * Business meaning (defaults, "due", "overdue") is resolved by the service layer.
 */
export interface TennerCriteria {
  readonly assignedTo?: UserId | undefined;
  readonly category?: Category | undefined;
  readonly active?: boolean | undefined;
  /** Inclusive upper bound for nextDue (YYYY-MM-DD). */
  readonly nextDueOnOrBefore?: string | undefined;
  /** Exclusive upper bound for nextDue (YYYY-MM-DD). */
  readonly nextDueBefore?: string | undefined;
  /** Include soft-deleted Tenners. Default: false (deleted Tenners are excluded). */
  readonly includeDeleted?: boolean | undefined;
}

/** Outcome of a soft delete (TICKET-012). */
export interface SoftDeleteResult {
  readonly status: "DELETED" | "ALREADY_DELETED";
  /** State after the operation. */
  readonly tenner: Tenner;
}

/** Fields that may change through an update, plus the new updatedAt timestamp (TICKET-011). */
export type TennerUpdate = {
  readonly [K in "title" | "category" | "estimatedMinutes" | "frequencyDays" | "assignedTo" | "active"]?: Tenner[K] | undefined;
} & { readonly updatedAt: string };

/**
 * Persistence contract for Tenners. Implementations translate storage failures into
 * PersistenceError and never validate input (that is the service's job).
 */
export interface TennerRepository {
  /** The Tenner (including soft-deleted ones) or undefined. */
  getById(tenantId: string, tennerId: string): Promise<Tenner | undefined>;
  /** All matching Tenners (unordered; all result pages). */
  list(tenantId: string, criteria?: TennerCriteria): Promise<Tenner[]>;
  /** Insert a new Tenner. Fails with ConflictError if the ID already exists. */
  save(tenner: Tenner): Promise<void>;
  /**
   * Atomically set the given fields on an existing Tenner and return the updated Tenner.
   * Other attributes (e.g. lastCompleted, nextDue) are untouched, so concurrent completions are not lost.
   * Fails with NotFoundError if the Tenner does not exist or is soft-deleted.
   */
  update(tenantId: string, tennerId: string, changes: TennerUpdate): Promise<Tenner>;
  /**
   * Soft delete: set active = false, deletedAt and updatedAt to the given timestamp. Never removes the item.
   * Reports ALREADY_DELETED (without changes) for deleted Tenners; NotFoundError if missing.
   */
  delete(tenantId: string, tennerId: string, timestamp: string): Promise<SoftDeleteResult>;
}
