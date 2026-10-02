/** Business logic for soft-deleting Tenners (TICKET-012). */

import type { DeleteTennerResponse } from "../dto/index.js";
import type { SoftDeleteResult, TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export interface DeleteTennerResult {
  readonly response: DeleteTennerResponse;
  /** Repository outcome (used for logging; both outcomes are a success for the client). */
  readonly outcome: SoftDeleteResult;
}

export class DeleteTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "delete">,
    private readonly clock: Clock,
  ) {}

  /**
   * Soft delete: active = false, deletedAt = updatedAt = now. Idempotent: deleting an already
   * deleted Tenner succeeds without changes. Completion history is never touched.
   */
  async deleteTenner(tenantId: string, tennerId: string): Promise<DeleteTennerResult> {
    const outcome = await this.repository.delete(tenantId, tennerId, toUtcTimestamp(this.clock()));
    return { response: { tennerId, deleted: true }, outcome };
  }
}
