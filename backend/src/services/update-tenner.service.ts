/** Business logic for updating Tenners (TICKET-011). */

import { toTennerResponse, type UpdateTennerRequest, type UpdateTennerResponse } from "../dto/index.js";
import type { Identity } from "../auth/index.js";
import type { TennerRepository, TennerUpdate } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export class UpdateTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "update">,
    private readonly clock: Clock,
  ) {}

  /**
   * Apply a validated partial update. Only allowed fields are copied (protected fields can never pass),
   * updatedAt/updatedBy are refreshed, and the schedule (lastCompleted, nextDue) stays untouched even when
   * the frequency changes.
   */
  async updateTenner(identity: Identity, tennerId: string, request: UpdateTennerRequest): Promise<UpdateTennerResponse> {
    const changes: TennerUpdate = {
      title: request.title,
      category: request.category,
      estimatedMinutes: request.estimatedMinutes,
      frequencyDays: request.frequencyDays,
      frequencyUnit: request.frequencyUnit,
      frequencyInterval: request.frequencyInterval,
      assignedTo: request.assignedTo,
      active: request.active,
      updatedAt: toUtcTimestamp(this.clock()),
      updatedBy: identity.userId,
    };
    return toTennerResponse(await this.repository.update(identity.tenantId, tennerId, changes));
  }
}
