import type { Completion, UserId } from "../models/index.js";

export type HistoryKey = Readonly<Record<string, string>>;

/** One page of history (TICKET-020). */
export interface HistoryQuery {
  /** Inclusive ISO 8601 lower bound for completedAt. */
  readonly from?: string | undefined;
  /** Inclusive ISO 8601 upper bound for completedAt. */
  readonly to?: string | undefined;
  readonly completedBy?: UserId | undefined;
  /** Include reverted (undone) completions. Default: false. */
  readonly includeReverted?: boolean | undefined;
  /** Maximum items in the page. */
  readonly limit: number;
  /** Key after which to continue (from a previous page). */
  readonly startKey?: HistoryKey | undefined;
}

export interface HistoryPage {
  readonly items: Completion[];
  /** Key of the last returned item if more items may follow. */
  readonly lastKey?: HistoryKey | undefined;
}

/** A stored completion including idempotency metadata (TICKET-013). */
export interface CompletionRecord {
  readonly completion: Completion;
  /** Client-provided Idempotency-Key, if any. */
  readonly idempotencyKey?: string | undefined;
  /** Hash of the original request, used to detect conflicting key reuse. */
  readonly requestHash?: string | undefined;
  /** Idempotency-Key of the undo request that reverted this completion (TICKET-014). */
  readonly revertIdempotencyKey?: string | undefined;
  readonly revertRequestHash?: string | undefined;
}

/**
 * Persistence contract for the immutable completion history. Completions are only written together with
 * the Tenner state (TennerRepository.completeTenner / undoCompletion), so there is no standalone create().
 */
export interface CompletionRepository {
  /** A single history record by its ID (historyId), or undefined. */
  getById(tenantId: string, completionId: string): Promise<CompletionRecord | undefined>;
  /** Newest non-reverted completions of a Tenner (completedAt descending), at most `limit`. */
  getLatestActiveCompletions(tenantId: string, tennerId: string, limit: number): Promise<Completion[]>;
  /** The completion of a Tenner that was reverted with the given undo Idempotency-Key, if any. */
  findByRevertIdempotencyKey(tenantId: string, tennerId: string, key: string): Promise<CompletionRecord | undefined>;
  /** Household history, newest first (completedAt-index). */
  getHistory(tenantId: string, query: HistoryQuery): Promise<HistoryPage>;
  /** History of one Tenner, newest first (tennerId-completedAt-index). */
  getByTenner(tenantId: string, tennerId: string, query: HistoryQuery): Promise<HistoryPage>;
}
