/** Household settings: the timezone every due date is computed in (SCHEDULING-008) and the vacation (SCHEDULING-005). */

import type { Identity } from "../auth/index.js";
import type { HouseholdResponse } from "../dto/index.js";
import type { Vacation } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export class HouseholdService {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly clock: Clock,
    /** Used until a household saves its own timezone (APPLICATION_TIMEZONE, default Europe/Berlin). */
    private readonly defaultTimezone: string,
  ) {}

  /** The central accessor (getHouseholdTimezone): stored timezone or the default. */
  async timezoneOf(tenantId: string): Promise<string> {
    return (await this.repository.get(tenantId))?.timezone ?? this.defaultTimezone;
  }

  /** The household vacation, or null (SCHEDULING-005). */
  async vacationOf(tenantId: string): Promise<Vacation | null> {
    return (await this.repository.get(tenantId))?.vacation ?? null;
  }

  async getHousehold(tenantId: string): Promise<HouseholdResponse> {
    const settings = await this.repository.get(tenantId);
    return { timezone: settings?.timezone ?? this.defaultTimezone, vacation: settings?.vacation ?? null };
  }

  /** Any household member may change it (roles: HOUSEHOLD-ADMIN-005). The value is validated by the handler. */
  async updateTimezone(identity: Identity, timezone: string): Promise<HouseholdResponse> {
    const saved = await this.repository.saveTimezone(identity.tenantId, timezone, identity.userId, toUtcTimestamp(this.clock()));
    return { timezone: saved.timezone ?? this.defaultTimezone, vacation: saved.vacation };
  }
}
