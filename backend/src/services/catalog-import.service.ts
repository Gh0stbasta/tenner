/**
 * Household catalog import (DATA-008): adds the catalog members and Tenners that the household does not have yet.
 * Idempotent: a Tenner is skipped when a Tenner with the same title exists (also archived ones), a member when its ID
 * exists. A dry run reports the same result without writing.
 */

import type { Identity } from "../auth/index.js";
import { CATALOG_MEMBERS, CATALOG_TENNERS, type CatalogTenner } from "../catalog/household-catalog.js";
import type { CatalogImportResponse, CreateMemberRequest, CreateTennerRequest, MemberResponse, TennerResponse } from "../dto/index.js";
import { ConflictError } from "../exceptions/index.js";
import type { HouseholdMember } from "../models/index.js";
import type { TennerRepository } from "../repositories/index.js";
import { addDays, type Clock } from "../utils/clock.js";
import { approximateFrequencyDays, weekdayOf } from "../utils/schedule.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";

export interface CatalogImportDependencies {
  readonly membersOf: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly createMember: (identity: Identity, request: CreateMemberRequest) => Promise<MemberResponse>;
  readonly tenners: Pick<TennerRepository, "list">;
  readonly createTenner: (identity: Identity, request: CreateTennerRequest, firstDue: string) => Promise<TennerResponse>;
  readonly timezoneOf: TimeZoneSource;
  readonly clock: Clock;
}

/** Title comparison ignores case and surrounding spaces. */
const key = (title: string): string => title.trim().toLocaleLowerCase("de-DE");

/** Today, or for weekday-bound entries the `slot`-th matching weekday from today (today included). */
export function firstDueOf(entry: Pick<CatalogTenner, "weekdays" | "slot">, today: string): string {
  const weekday = entry.weekdays?.[0];
  if (!weekday) return today;
  let date = today;
  while (weekdayOf(date) !== weekday) date = addDays(date, 1);
  return addDays(date, entry.slot * 7);
}

export function toCreateRequest(entry: CatalogTenner): CreateTennerRequest {
  return {
    title: entry.title,
    category: entry.category,
    estimatedMinutes: entry.estimatedMinutes,
    frequencyDays: approximateFrequencyDays(entry.frequencyUnit, entry.frequencyInterval, entry.weekdays),
    frequencyUnit: entry.frequencyUnit,
    frequencyInterval: entry.frequencyInterval,
    weekdays: entry.weekdays,
    assignedTo: entry.assignedTo,
    assignmentMode: "FIXED",
    rotation: null,
  };
}

export class CatalogImportService {
  constructor(private readonly deps: CatalogImportDependencies) {}

  async importCatalog(identity: Identity, dryRun: boolean): Promise<CatalogImportResponse> {
    const { tenantId } = identity;
    const members = await this.deps.membersOf(tenantId);
    const memberIds = new Set(members.map((member) => member.userId));
    const newMembers = CATALOG_MEMBERS.filter((member) => !memberIds.has(member.userId));
    const known = new Set([...memberIds, ...newMembers.map((member) => member.userId)]);
    const missing = [...new Set(CATALOG_TENNERS.map((entry) => entry.assignedTo).filter((userId) => !known.has(userId)))];
    if (missing.length > 0) {
      throw new ConflictError(`The catalog assigns Tenners to members this household does not have: ${missing.join(", ")}.`, "CATALOG_MEMBERS_MISSING");
    }

    const existing = new Set((await this.deps.tenners.list(tenantId, { includeDeleted: true })).map((tenner) => key(tenner.title)));
    const toCreate = CATALOG_TENNERS.filter((entry) => !existing.has(key(entry.title)));
    const skipped = CATALOG_TENNERS.filter((entry) => existing.has(key(entry.title))).map((entry) => entry.title);

    if (!dryRun) {
      for (const member of newMembers) await this.deps.createMember(identity, member);
      const today = dateInTimeZone(this.deps.clock(), await this.deps.timezoneOf(tenantId));
      // Sequential: a failure leaves a consistent partial import that the next run completes.
      for (const entry of toCreate) await this.deps.createTenner(identity, toCreateRequest(entry), firstDueOf(entry, today));
    }
    return {
      dryRun,
      membersCreated: newMembers.map((member) => member.displayName),
      tennersCreated: toCreate.map((entry) => entry.title),
      tennersSkipped: skipped,
    };
  }
}
