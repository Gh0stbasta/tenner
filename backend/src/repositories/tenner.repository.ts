import type { Category, SnoozeEvent, Tenner, UserId } from "../models/index.js";
import type { CompletionRecord } from "./completion.repository.js";

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
  /** Only soft-deleted Tenners (archive view, TICKET-024). Wins over includeDeleted. */
  readonly onlyDeleted?: boolean | undefined;
}

/** Outcome of a soft delete (TICKET-012). */
export interface SoftDeleteResult {
  readonly status: "DELETED" | "ALREADY_DELETED";
  /** State after the operation. */
  readonly tenner: Tenner;
}

/** Fields that may change through an update, plus the new updatedAt timestamp (TICKET-011). */
export type TennerUpdate = {
  readonly [K in "title" | "category" | "estimatedMinutes" | "frequencyDays" | "frequencyUnit" | "frequencyInterval" | "weekdays" | "assignedTo" | "active"]?: Tenner[K] | undefined;
} & { readonly updatedAt: string; readonly updatedBy: UserId };

/**
 * Persistence contract for Tenners. Implementations translate storage failures into
 * PersistenceError and never validate input (that is the service's job).
 */
export interface TennerRepository {
  /** Titles of the given Tenners (including deleted ones); missing IDs are absent from the map (TICKET-020). */
  getTitles(tenantId: string, tennerIds: readonly string[]): Promise<Map<string, string>>;
  /** The Tenner (including soft-deleted ones) or undefined. */
  getById(tenantId: string, tennerId: string): Promise<Tenner | undefined>;
  /**
   * Dashboard candidates (TICKET-016): active, non-deleted Tenners with nextDue <= endDate, via nextDue-index.
   * No classification or summaries.
   */
  getDashboardCandidates(tenantId: string, endDate: string): Promise<Tenner[]>;
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
   * Soft delete: set active = false, deletedAt and updatedAt to the given timestamp, updatedBy = actor. Never removes the item.
   * Reports ALREADY_DELETED (without changes) for deleted Tenners; NotFoundError if missing.
   */
  delete(tenantId: string, tennerId: string, timestamp: string, actor: UserId): Promise<SoftDeleteResult>;
  /**
   * Atomically append a completion to the history and update the Tenner's schedule (TICKET-013).
   * `expected` is the Tenner state the update was computed from (optimistic locking).
   * Errors: ConflictError CONCURRENT_MODIFICATION if the Tenner changed,
   * ConflictError DUPLICATE_COMPLETION if the completion ID already exists, PersistenceError otherwise.
   */
  completeTenner(updated: Tenner, record: CompletionRecord, expected: Tenner): Promise<void>;
  /**
   * Atomically mark a completion as reverted and restore the Tenner schedule (TICKET-014).
   * `reverted` carries the revert metadata; `expected` is the loaded Tenner (optimistic locking).
   * Errors: ConflictError CONCURRENT_MODIFICATION if the Tenner changed or the completion was already reverted.
   */
  undoCompletion(restored: Tenner, reverted: CompletionRecord, expected: Tenner): Promise<void>;

  /**
   * Atomically record a snooze event in tenner-history and move the Tenner's nextDue (SCHEDULING-003).
   * `expected` is the loaded Tenner (optimistic locking on updatedAt, active, not deleted).
   * Errors: ConflictError CONCURRENT_MODIFICATION if the Tenner changed, PersistenceError otherwise.
   */
  snoozeTenner(updated: Tenner, event: SnoozeEvent, expected: Tenner): Promise<void>;
  /**
   * Undo a soft delete (TICKET-015): active = true, deletedAt = null, updatedAt = timestamp, updatedBy = actor.
   * Schedule fields are untouched. Optimistic lock on `expectedUpdatedAt`;
   * ConflictError CONCURRENT_MODIFICATION if the Tenner changed or does not exist.
   */
  restore(tenantId: string, tennerId: string, expectedUpdatedAt: string, timestamp: string, actor: UserId): Promise<Tenner>;
}
