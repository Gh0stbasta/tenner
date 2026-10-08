/** Business logic for creating Tenners (TICKET-009). */

import type { CreateTennerRequest, TennerResponse } from "../dto/index.js";
import { toTennerResponse } from "../dto/index.js";
import type { Identity } from "../auth/index.js";
import { SEED_CATEGORIES, SEED_MEMBERS, type Tenner } from "../models/index.js";
import { requireSelectableCategory, type CategorySource } from "./category.service.js";
import type { TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../utils/clock.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";
import { requireAssignee, requireMember, type MemberSource } from "./member.service.js";

export class CreateTennerService {
  constructor(
    private readonly repository: Pick<TennerRepository, "save">,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
    private readonly timezoneOf: TimeZoneSource,
    private readonly membersOf: MemberSource = async () => SEED_MEMBERS,
    private readonly categoriesOf: CategorySource = async () => SEED_CATEGORIES,
  ) {}

  /**
   * Create a Tenner from a validated request. Defaults: new UUID, active, never completed,
   * due today in the household timezone (so it appears in the due list immediately), createdAt = updatedAt = now,
   * createdBy = updatedBy = the authenticated user, tenant from the identity.
   */
  async createTenner(identity: Identity, request: CreateTennerRequest, firstDue?: string): Promise<TennerResponse> {
    const members = await this.membersOf(identity.tenantId);
    requireAssignee(members, request.assignedTo);
    for (const userId of request.rotation ?? []) requireMember(members, userId, "rotation");
    requireSelectableCategory(await this.categoriesOf(identity.tenantId), request.category);
    const now = this.clock();
    const timestamp = toUtcTimestamp(now);
    const today = dateInTimeZone(now, await this.timezoneOf(identity.tenantId));
    // HOTFIX-006: due on the start day at the earliest; a past start date makes it due today.
    const startDate = request.startDate ?? today;
    const tenner: Tenner = {
      tenantId: identity.tenantId,
      tennerId: this.newId(),
      title: request.title,
      category: request.category,
      estimatedMinutes: request.estimatedMinutes,
      frequencyDays: request.frequencyDays,
      frequencyUnit: request.frequencyUnit,
      frequencyInterval: request.frequencyInterval,
      weekdays: request.weekdays,
      assignedTo: request.assignedTo,
      assignmentMode: request.assignmentMode,
      rotation: request.rotation,
      originalAssignee: null,
      lastCompleted: null,
      // DATA-008: the catalog import sets the first due date (weekday and rotation slot); the API never does.
      nextDue: firstDue ?? (startDate > today ? startDate : today),
      startDate,
      snoozedUntil: null,
      pausedAt: null,
      pausedUntil: null,
      active: true,
      deletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: identity.userId,
      updatedBy: identity.userId,
    };
    await this.repository.save(tenner);
    return toTennerResponse(tenner);
  }
}
