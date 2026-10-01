/** Business logic for creating Tenners (TICKET-009). */

import type { CreateTennerRequest, TennerResponse } from "../dto/index.js";
import { toTennerResponse } from "../dto/index.js";
import type { Tenner } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { toUtcDate, toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";

export class CreateTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "save">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
  ) {}

  /**
   * Create a Tenner from a validated request. Defaults: new UUID, active, never completed,
   * due today (so it appears in the due list immediately), createdAt = updatedAt = now.
   */
  async createTenner(tenantId: string, request: CreateTennerRequest): Promise<TennerResponse> {
    const now = this.clock();
    const timestamp = toUtcTimestamp(now);
    const tenner: Tenner = {
      tenantId,
      tennerId: this.newId(),
      title: request.title,
      category: request.category,
      estimatedMinutes: request.estimatedMinutes,
      frequencyDays: request.frequencyDays,
      assignedTo: request.assignedTo,
      lastCompleted: null,
      nextDue: toUtcDate(now),
      active: true,
      deletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.save(tenner);
    return toTennerResponse(tenner);
  }
}
