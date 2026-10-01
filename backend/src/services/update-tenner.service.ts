/** Business logic for updating Tenners (TICKET-011). */

import { toTennerResponse, type UpdateTennerRequest, type UpdateTennerResponse } from "../dto/index.js";
import type { TennerRepository, TennerUpdate } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export class UpdateTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "update">,
    private readonly clock: Clock,
  ) {}

  /**
   * Apply a validated partial update. Only allowed fields are copied (protected fields can never pass),
   * updatedAt is refreshed, and the schedule (lastCompleted, nextDue) stays untouched even when
   * frequencyDays changes.
   */
  async updateTenner(tenantId: string, tennerId: string, request: UpdateTennerRequest): Promise<UpdateTennerResponse> {
    const changes: TennerUpdate = {
      title: request.title,
      category: request.category,
      estimatedMinutes: request.estimatedMinutes,
      frequencyDays: request.frequencyDays,
      assignedTo: request.assignedTo,
      active: request.active,
      updatedAt: toUtcTimestamp(this.clock()),
    };
    return toTennerResponse(await this.repository.update(tenantId, tennerId, changes));
  }
}
