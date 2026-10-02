/** Business logic for reading a single Tenner (TICKET-019). */

import { toTennerResponse, type TennerResponse } from "../dto/index.js";
import { NotFoundError } from "../exceptions/index.js";
import type { TennerRepository } from "../repositories/index.js";

export class GetTennerService {
  constructor(private readonly repository: Pick<TennerRepository, "getById">) {}

  /** The Tenner of this tenant. Soft-deleted Tenners are only returned with includeDeleted. */
  async getTenner(tenantId: string, tennerId: string, options: { includeDeleted?: boolean | undefined } = {}): Promise<TennerResponse> {
    const tenner = await this.repository.getById(tenantId, tennerId);
    if (!tenner || (tenner.deletedAt !== null && !options.includeDeleted)) throw new NotFoundError("Tenner not found.");
    return toTennerResponse(tenner);
  }
}
