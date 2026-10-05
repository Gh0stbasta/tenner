/**
 * Temporary handover (HOUSEHOLD-004): one member's Tenners are covered by another member until a date and then given
 * back. The handover lives on the household item; affected Tenners carry `originalAssignee`. There is no scheduler:
 * expired handovers are given back on the next read of the dashboard, the Tenner list or the household settings.
 */

import type { Identity } from "../auth/index.js";
import type { EndHandoverResponse, StartHandoverRequest, StartHandoverResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { handoverCovers, isHandoverActive, SEED_CATEGORIES, SEED_MEMBERS, type Handover, type HouseholdMember, type UserId } from "../models/index.js";
import type { HouseholdRepository, TennerRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";
import type { Logger } from "../utils/logger.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";
import { toHandoverResponse } from "./household.service.js";

/** Running handovers of a household (used by completions to keep a rotation on cover). */
export type HandoverSource = (tenantId: string) => Promise<readonly Handover[]>;

export class HandoverService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "saveHandovers">,
    private readonly tenners: Pick<TennerRepository, "list" | "update">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
    private readonly logger: Logger,
  ) {}

  async handoversOf(tenantId: string): Promise<readonly Handover[]> {
    return (await this.households.get(tenantId))?.handovers ?? [];
  }

  /**
   * Hand the member's Tenners (all non-deleted ones assigned to them, optionally of some categories) to `to`.
   * Rules: both active members, different, `to` not away itself (400); `until` not in the past (400); one running
   * handover per member (409 HANDOVER_ACTIVE) — repeating the identical request finishes an interrupted one.
   * Tenners the member covers for someone else move on but keep their original assignee.
   */
  async start(identity: Identity, from: UserId, request: StartHandoverRequest): Promise<StartHandoverResponse> {
    const { tenantId } = identity;
    const settings = await this.households.get(tenantId);
    const members = settings?.members ?? SEED_MEMBERS;
    const member = members.find((candidate) => candidate.userId === from);
    if (!member) throw new NotFoundError("Household member not found.");
    if (!member.active) throw new ConflictError("Deactivated members have no Tenners to hand over.", "MEMBER_INACTIVE");
    const invalid = (field: string, message: string) => new ValidationError("Invalid handover.", [{ field, message }]);
    if (request.to === from) throw invalid("to", "Must be another member.");
    if (!members.some((candidate) => candidate.userId === request.to && candidate.active)) throw invalid("to", "Must be an active household member.");
    const categories = settings?.categories ?? SEED_CATEGORIES;
    const unknown = (request.categories ?? []).filter((category) => !categories.some((candidate) => candidate.categoryId === category));
    if (unknown.length > 0) throw invalid("categories", `Unknown categories: ${unknown.join(", ")}.`);

    const now = this.clock();
    const today = dateInTimeZone(now, await this.timezoneOf(tenantId));
    if (request.until < today) throw invalid("until", "Must not be in the past.");
    const running = (settings?.handovers ?? []).filter((handover) => isHandoverActive(handover, today));
    if (running.some((handover) => handover.from === request.to)) throw invalid("to", "This member has handed over their own Tenners.");

    const timestamp = toUtcTimestamp(now);
    const handover: Handover = { from, to: request.to, until: request.until, categories: request.categories ?? null, createdAt: timestamp, createdBy: identity.userId };
    const existing = (settings?.handovers ?? []).find((candidate) => candidate.from === from);
    if (existing && isHandoverActive(existing, today) && !sameHandover(existing, handover)) {
      throw new ConflictError("This member already hands over their Tenners. End it first.", "HANDOVER_ACTIVE");
    }
    if (existing && !isHandoverActive(existing, today)) await this.giveBack(tenantId, existing, members, identity.userId, timestamp);
    if (!existing || !isHandoverActive(existing, today)) {
      const others = (settings?.handovers ?? []).filter((candidate) => candidate.from !== from);
      await this.households.saveHandovers(tenantId, [...others, handover], settings?.handoversVersion ?? 0, identity.userId, timestamp);
    }

    // Saved first: if a Tenner update fails, the identical request finishes the move.
    const affected = (await this.tenners.list(tenantId, { assignedTo: from })).filter((tenner) => handoverCovers(handover, tenner.category));
    for (const tenner of affected) {
      await this.tenners.update(tenantId, tenner.tennerId, {
        assignedTo: handover.to,
        originalAssignee: tenner.originalAssignee ?? from,
        updatedAt: timestamp,
        updatedBy: identity.userId,
      });
    }
    return { handover: toHandoverResponse(existing && isHandoverActive(existing, today) ? existing : handover), handedOver: affected.length };
  }

  /** End the member's handover now: the Tenners come back (404 without one). */
  async end(identity: Identity, from: UserId): Promise<EndHandoverResponse> {
    const { tenantId } = identity;
    const settings = await this.households.get(tenantId);
    const handover = settings?.handovers.find((candidate) => candidate.from === from);
    if (!settings || !handover) throw new NotFoundError("This member has no handover.");
    const timestamp = toUtcTimestamp(this.clock());
    // Give back first, then remove: a failure leaves the handover in place and a retry finishes.
    const returned = await this.giveBack(tenantId, handover, settings.members ?? SEED_MEMBERS, identity.userId, timestamp);
    await this.households.saveHandovers(tenantId, settings.handovers.filter((candidate) => candidate !== handover), settings.handoversVersion, identity.userId, timestamp);
    return { returned };
  }

  /**
   * Give back every handover whose last day has passed. Called before reads; never fails the read (errors are
   * logged, the next read retries). Costs one GetItem when nothing has expired.
   */
  async expireDue(tenantId: string): Promise<void> {
    try {
      const settings = await this.households.get(tenantId);
      if (!settings || settings.handovers.length === 0) return;
      const today = dateInTimeZone(this.clock(), await this.timezoneOf(tenantId));
      const expired = settings.handovers.filter((handover) => !isHandoverActive(handover, today));
      if (expired.length === 0) return;
      const timestamp = toUtcTimestamp(this.clock());
      for (const handover of expired) {
        const returned = await this.giveBack(tenantId, handover, settings.members ?? SEED_MEMBERS, actorOf(handover), timestamp);
        this.logger.info("Handover ended", { event: "HandoverExpired", from: handover.from, to: handover.to, until: handover.until, returned });
      }
      await this.households.saveHandovers(tenantId, settings.handovers.filter((handover) => !expired.includes(handover)), settings.handoversVersion, actorOf(expired[0] as Handover), timestamp);
    } catch (error) {
      // A concurrent read may have expired the same handover first (CONCURRENT_MODIFICATION); anything else retries later.
      this.logger.warn("Handover expiry skipped", { errorCode: error instanceof ConflictError ? error.code : "UNEXPECTED", error: String(error) });
    }
  }

  /**
   * Tenners covered for `handover.from` go back to them and lose `originalAssignee` (idempotent). A member deactivated
   * meanwhile does not get Tenners back; the cover keeps them.
   */
  private async giveBack(tenantId: string, handover: Handover, members: readonly HouseholdMember[], actor: UserId, timestamp: string): Promise<number> {
    const fromActive = members.some((member) => member.userId === handover.from && member.active);
    const covered = (await this.tenners.list(tenantId)).filter((tenner) => tenner.originalAssignee === handover.from);
    for (const tenner of covered) {
      await this.tenners.update(tenantId, tenner.tennerId, {
        assignedTo: fromActive ? handover.from : tenner.assignedTo,
        originalAssignee: null,
        updatedAt: timestamp,
        updatedBy: actor,
      });
    }
    return covered.length;
  }
}

const sameHandover = (a: Handover, b: Handover): boolean =>
  a.to === b.to && a.until === b.until && JSON.stringify(a.categories) === JSON.stringify(b.categories);

/** Automatic give-backs are attributed to whoever started the handover. */
const actorOf = (handover: Handover): UserId => handover.createdBy || handover.from;
