import type { Completion } from "../models/index.js";

export interface HistoryQuery {
  /** Inclusive ISO 8601 lower bound for completedAt. */
  readonly from?: string;
  /** Inclusive ISO 8601 upper bound for completedAt. */
  readonly to?: string;
  readonly limit?: number;
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

/** Persistence contract for the immutable completion history. */
export interface CompletionRepository {
  /** A single history record by its ID (historyId), or undefined. */
  getById(tenantId: string, completionId: string): Promise<CompletionRecord | undefined>;
  /** Newest non-reverted completions of a Tenner (completedAt descending), at most `limit`. */
  getLatestActiveCompletions(tenantId: string, tennerId: string, limit: number): Promise<Completion[]>;
  /** The completion of a Tenner that was reverted with the given undo Idempotency-Key, if any. */
  findByRevertIdempotencyKey(tenantId: string, tennerId: string, key: string): Promise<CompletionRecord | undefined>;
  create(completion: Completion): Promise<void>;
  /** Household history, newest first. */
  getHistory(tenantId: string, query?: HistoryQuery): Promise<Completion[]>;
  /** History of one Tenner, newest first. */
  getByTenner(tenantId: string, tennerId: string, query?: HistoryQuery): Promise<Completion[]>;
}
