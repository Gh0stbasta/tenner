/**
 * Household settings: name, timezone (SCHEDULING-008), week start, workdays and defaults for new Tenners
 * (HOUSEHOLD-ADMIN-003), vacation (SCHEDULING-005). One item per tenant in tenner-households; backend code reads the
 * effective values through settingsOf.
 */

import type { Identity } from "../auth/index.js";
import type { HandoverResponse, HouseholdResponse, UpdateHouseholdRequest } from "../dto/index.js";
import {
  DEFAULT_HOUSEHOLD_NAME,
  DEFAULT_TENNER_DEFAULTS,
  DEFAULT_WEEK_START,
  DEFAULT_WORKDAYS,
  SEED_CATEGORIES,
  type Handover,
  type HouseholdSettings,
  type Vacation,
} from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";
import { requireSelectableCategory, type CategorySource } from "./category.service.js";

export class HouseholdService {
  constructor(
    private readonly repository: Pick<HouseholdRepository, "get" | "saveSettings">,
    private readonly clock: Clock,
    /** Used until a household saves its own timezone (APPLICATION_TIMEZONE, default Europe/Berlin). */
    private readonly defaultTimezone: string,
    private readonly categoriesOf: CategorySource = async () => SEED_CATEGORIES,
  ) {}

  /** The central accessor (getHouseholdTimezone): stored timezone or the default. */
  async timezoneOf(tenantId: string): Promise<string> {
    return (await this.repository.get(tenantId))?.timezone ?? this.defaultTimezone;
  }

  /** The household vacation, or null (SCHEDULING-005). */
  async vacationOf(tenantId: string): Promise<Vacation | null> {
    return (await this.repository.get(tenantId))?.vacation ?? null;
  }

  /** Effective settings for backend consumers (analytics week buckets, workdays, notifications). */
  async settingsOf(tenantId: string): Promise<HouseholdResponse> {
    return toHouseholdResponse(await this.repository.get(tenantId), this.defaultTimezone);
  }

  async getHousehold(tenantId: string): Promise<HouseholdResponse> {
    return this.settingsOf(tenantId);
  }

  /**
   * Save any subset of the settings. Any household member may change them (there are no roles).
   * Formats are validated by the handler; the default category must be a selectable household category.
   */
  async updateSettings(identity: Identity, request: UpdateHouseholdRequest): Promise<HouseholdResponse> {
    if (request.defaults) requireSelectableCategory(await this.categoriesOf(identity.tenantId), request.defaults.category);
    const saved = await this.repository.saveSettings(identity.tenantId, request, identity.userId, toUtcTimestamp(this.clock()));
    return toHouseholdResponse(saved, this.defaultTimezone);
  }
}

export function toHandoverResponse(handover: Handover): HandoverResponse {
  return { from: handover.from, to: handover.to, until: handover.until, categories: handover.categories };
}

/** Stored values with defaults applied. */
export function toHouseholdResponse(settings: HouseholdSettings | undefined, defaultTimezone: string): HouseholdResponse {
  return {
    name: settings?.name ?? DEFAULT_HOUSEHOLD_NAME,
    timezone: settings?.timezone ?? defaultTimezone,
    weekStartsOn: settings?.weekStartsOn ?? DEFAULT_WEEK_START,
    workdays: settings?.workdays ?? DEFAULT_WORKDAYS,
    defaults: settings?.defaults ?? DEFAULT_TENNER_DEFAULTS,
    defaultsSource: settings?.defaults ? "HOUSEHOLD" : "DEFAULT",
    vacation: settings?.vacation ?? null,
    handovers: (settings?.handovers ?? []).map(toHandoverResponse),
  };
}
