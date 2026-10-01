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
}

/**
 * Persistence contract for Tenners. Implementations translate storage failures into
 * PersistenceError and never validate input (that is the service's job).
 */
export interface TennerRepository {
  getById(tenantId: string, tennerId: string): Promise<Tenner | undefined>;
  /** All matching Tenners (unordered; all result pages). */
  list(tenantId: string, criteria?: TennerCriteria): Promise<Tenner[]>;
  /** Insert a new Tenner. Fails with ConflictError if the ID already exists. */
  save(tenner: Tenner): Promise<void>;
  /** Replace an existing Tenner. Fails with NotFoundError if it does not exist. */
  update(tenner: Tenner): Promise<void>;
  delete(tenantId: string, tennerId: string): Promise<void>;
}
