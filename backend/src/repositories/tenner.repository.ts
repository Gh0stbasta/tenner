import type { Tenner } from "../models/index.js";

export interface ListTennersOptions {
  /** Include soft-deleted / inactive Tenners. Default: false. */
  readonly includeInactive?: boolean;
}

/**
 * Persistence contract for Tenners. Implementations translate storage failures into
 * PersistenceError and never validate input (that is the service's job).
 */
export interface TennerRepository {
  getById(tenantId: string, tennerId: string): Promise<Tenner | undefined>;
  list(tenantId: string, options?: ListTennersOptions): Promise<Tenner[]>;
  /** Insert a new Tenner. Fails with ConflictError if the ID already exists. */
  save(tenner: Tenner): Promise<void>;
  /** Replace an existing Tenner. Fails with NotFoundError if it does not exist. */
  update(tenner: Tenner): Promise<void>;
  delete(tenantId: string, tennerId: string): Promise<void>;
}
