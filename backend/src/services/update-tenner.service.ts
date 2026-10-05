/** Business logic for updating Tenners (TICKET-011). */

import { toTennerResponse, type UpdateTennerRequest, type UpdateTennerResponse } from "../dto/index.js";
import type { Identity } from "../auth/index.js";
import { SEED_CATEGORIES, SEED_MEMBERS } from "../models/index.js";
import { requireSelectableCategory, type CategorySource } from "./category.service.js";
import type { TennerRepository, TennerUpdate } from "../repositories/index.js";
import { requireAssignee, requireMember, type MemberSource } from "./member.service.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export class UpdateTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "update">,
    private readonly clock: Clock,
    private readonly membersOf: MemberSource = async () => SEED_MEMBERS,
    private readonly categoriesOf: CategorySource = async () => SEED_CATEGORIES,
  ) {}

  /**
   * Apply a validated partial update. Only allowed fields are copied (protected fields can never pass),
   * updatedAt/updatedBy are refreshed, and the schedule (lastCompleted, nextDue) stays untouched even when
   * the frequency changes.
   */
  async updateTenner(identity: Identity, tennerId: string, request: UpdateTennerRequest): Promise<UpdateTennerResponse> {
    if (request.assignedTo !== undefined || request.rotation) {
      const members = await this.membersOf(identity.tenantId);
      if (request.assignedTo !== undefined) requireAssignee(members, request.assignedTo);
      for (const userId of request.rotation ?? []) requireMember(members, userId, "rotation");
    }
    // An archived category stays on existing Tenners; it can only not be chosen anew (HOUSEHOLD-ADMIN-002).
    if (request.category !== undefined) requireSelectableCategory(await this.categoriesOf(identity.tenantId), request.category);
    const changes: TennerUpdate = {
      title: request.title,
      category: request.category,
      estimatedMinutes: request.estimatedMinutes,
      frequencyDays: request.frequencyDays,
      frequencyUnit: request.frequencyUnit,
      frequencyInterval: request.frequencyInterval,
      weekdays: request.weekdays,
      assignedTo: request.assignedTo,
      // A manual reassignment ends the handover for this Tenner (HOUSEHOLD-004).
      originalAssignee: request.assignedTo !== undefined ? null : undefined,
      assignmentMode: request.assignmentMode,
      rotation: request.rotation,
      active: request.active,
      updatedAt: toUtcTimestamp(this.clock()),
      updatedBy: identity.userId,
    };
    return toTennerResponse(await this.repository.update(identity.tenantId, tennerId, changes));
  }
}
