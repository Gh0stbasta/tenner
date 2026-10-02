/** Business logic for restoring a soft-deleted Tenner (TICKET-015). */

import type { Identity } from "../auth/index.js";
import type { RestoreTennerResponse } from "../dto/index.js";
import { ConflictError, NotFoundError } from "../exceptions/index.js";
import type { Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export interface RestoreTennerOutcome {
  readonly response: RestoreTennerResponse;
  readonly status: "RESTORED" | "ALREADY_ACTIVE";
  /** deletedAt before the restore (null if it was already active). */
  readonly previousDeletedAt: string | null;
}

const isRestored = (tenner: Tenner): boolean => tenner.active && tenner.deletedAt === null;

const toResponse = (tenner: Tenner): RestoreTennerResponse => ({ tennerId: tenner.tennerId, active: tenner.active, deletedAt: tenner.deletedAt });

export class RestoreTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "getById" | "restore">,
    private readonly clock: Clock,
  ) {}

  /**
   * Restore a soft-deleted Tenner: active = true, deletedAt = null, updatedAt = now, updatedBy = the authenticated user. The schedule
   * (lastCompleted, nextDue) and the completion history are never touched. Idempotent for active Tenners.
   */
  async restoreTenner(identity: Identity, tennerId: string): Promise<RestoreTennerOutcome> {
    const { tenantId, userId } = identity;
    const tenner = await this.repository.getById(tenantId, tennerId);
    if (!tenner) throw new NotFoundError("Tenner not found.");
    if (isRestored(tenner)) return { response: toResponse(tenner), status: "ALREADY_ACTIVE", previousDeletedAt: null };
    if (tenner.deletedAt === null) {
      throw new ConflictError("Only deleted Tenners can be restored. Reactivate inactive Tenners with PUT.", "TENNER_NOT_DELETED");
    }

    try {
      const restored = await this.repository.restore(tenantId, tennerId, tenner.updatedAt, toUtcTimestamp(this.clock()), userId);
      return { response: toResponse(restored), status: "RESTORED", previousDeletedAt: tenner.deletedAt };
    } catch (error) {
      // A parallel restore that already succeeded is not a conflict for the client (idempotency).
      if (error instanceof ConflictError && error.code === "CONCURRENT_MODIFICATION") {
        const current = await this.repository.getById(tenantId, tennerId);
        if (current && isRestored(current)) return { response: toResponse(current), status: "ALREADY_ACTIVE", previousDeletedAt: tenner.deletedAt };
      }
      throw error;
    }
  }
}
