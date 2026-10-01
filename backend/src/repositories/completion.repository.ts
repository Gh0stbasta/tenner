import type { Completion } from "../models/index.js";

export interface HistoryQuery {
  /** Inclusive ISO 8601 lower bound for completedAt. */
  readonly from?: string;
  /** Inclusive ISO 8601 upper bound for completedAt. */
  readonly to?: string;
  readonly limit?: number;
}

/** Persistence contract for the immutable completion history. */
export interface CompletionRepository {
  create(completion: Completion): Promise<void>;
  /** Household history, newest first. */
  getHistory(tenantId: string, query?: HistoryQuery): Promise<Completion[]>;
  /** History of one Tenner, newest first. */
  getByTenner(tenantId: string, tennerId: string, query?: HistoryQuery): Promise<Completion[]>;
}
