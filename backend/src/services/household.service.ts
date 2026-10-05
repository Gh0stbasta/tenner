/** Household settings (SCHEDULING-008): the timezone every due date is computed in. */

import type { Identity } from "../auth/index.js";
import type { HouseholdResponse } from "../dto/index.js";
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

  async getHousehold(tenantId: string): Promise<HouseholdResponse> {
    return { timezone: await this.timezoneOf(tenantId) };
  }

  /** Any household member may change it (roles: HOUSEHOLD-ADMIN-005). The value is validated by the handler. */
  async updateTimezone(identity: Identity, timezone: string): Promise<HouseholdResponse> {
    const saved = await this.repository.saveTimezone(identity.tenantId, timezone, identity.userId, toUtcTimestamp(this.clock()));
    return { timezone: saved.timezone };
  }
}
