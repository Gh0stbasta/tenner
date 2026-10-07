/**
 * Actions from push notifications (NOTIFICATION-011), POST /push-actions without a login: the signed token names the
 * member, the Tenner, its cycle and the action. „Erledigt“ completes exactly that cycle (Idempotency-Key = token ID);
 * „Später“ schedules the reminder again according to the member's choice (1 hour, this evening, tomorrow morning).
 */

import { ConflictError, ForbiddenError, UnauthorizedError } from "../exceptions/index.js";
import { MAX_PUSH_SNOOZES, type HouseholdMember, type NotificationPreferences, type PushSnooze } from "../models/index.js";
import { InvalidActionTokenError, verifyActionToken, type ActionClaims } from "../push/action-token.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { addDays, toUtcTimestamp, type Clock } from "../utils/clock.js";
import { dateInTimeZone, localDateTimeToInstant } from "../utils/timezone.js";
import type { CompleteTennerOutcome } from "./complete-tenner.service.js";

export type PushActionResult =
  | { readonly action: "DONE"; readonly result: "COMPLETED" | "ALREADY_DONE"; readonly title: string | null }
  | { readonly action: "SNOOZE"; readonly result: "SNOOZED"; readonly remindAt: string };

export interface PushActionDependencies {
  readonly secret: () => Promise<string>;
  readonly membersOf: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly preferencesOf: (tenantId: string, userId: string) => Promise<NotificationPreferences>;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  readonly complete: (claims: ActionClaims) => Promise<CompleteTennerOutcome>;
  readonly households: Pick<HouseholdRepository, "get" | "savePushSnoozes">;
  readonly clock: Clock;
}

/** When „Später“ reminds again: in an hour, at the evening time (or in an hour if it has passed), tomorrow morning. */
export function remindAt(preferences: NotificationPreferences, timeZone: string, now: Date): Date {
  const inAnHour = new Date(now.getTime() + 3600_000);
  const today = dateInTimeZone(now, timeZone);
  switch (preferences.pushSnooze) {
    case "1H":
      return inAnHour;
    case "EVENING": {
      const evening = localDateTimeToInstant(today, preferences.overdueAlerts.time, timeZone);
      return evening > now ? evening : inAnHour;
    }
    case "TOMORROW":
      return localDateTimeToInstant(addDays(today, 1), preferences.dailyDigest.time, timeZone);
  }
}

export class PushActionService {
  constructor(private readonly deps: PushActionDependencies) {}

  async handle(token: string): Promise<PushActionResult> {
    const now = this.deps.clock();
    let claims: ActionClaims;
    try {
      claims = verifyActionToken(token, await this.deps.secret(), now);
    } catch (error) {
      if (error instanceof InvalidActionTokenError) throw new UnauthorizedError("The action link is invalid or expired.");
      throw error;
    }
    const member = (await this.deps.membersOf(claims.tenantId)).find((candidate) => candidate.userId === claims.userId);
    if (!member?.active) throw new ForbiddenError("The member of this action link is no longer active.");
    return claims.action === "DONE" ? this.done(claims) : this.snooze(claims, now);
  }

  private async done(claims: ActionClaims): Promise<PushActionResult> {
    try {
      const outcome = await this.deps.complete(claims);
      return { action: "DONE", result: "COMPLETED", title: outcome.response.tenner.title };
    } catch (error) {
      // Someone (or this link before) completed the cycle already: not an error for the person tapping.
      if (error instanceof ConflictError && error.code === "TENNER_CYCLE_CHANGED") return { action: "DONE", result: "ALREADY_DONE", title: null };
      throw error;
    }
  }

  private async snooze(claims: ActionClaims, now: Date): Promise<PushActionResult> {
    const preferences = await this.deps.preferencesOf(claims.tenantId, claims.userId);
    const at = remindAt(preferences, preferences.timezone ?? (await this.deps.timezoneOf(claims.tenantId)), now);
    const settings = await this.deps.households.get(claims.tenantId);
    const others = (settings?.pushSnoozes ?? []).filter((snooze) => !(snooze.userId === claims.userId && snooze.tennerId === claims.tennerId));
    const timestamp = toUtcTimestamp(now);
    const entry: PushSnooze = { userId: claims.userId, tennerId: claims.tennerId, nextDue: claims.nextDue, remindAt: toUtcTimestamp(at), createdAt: timestamp };
    await this.deps.households.savePushSnoozes(claims.tenantId, [...others, entry].slice(-MAX_PUSH_SNOOZES), settings?.pushSnoozesVersion ?? 0, claims.userId, timestamp);
    return { action: "SNOOZE", result: "SNOOZED", remindAt: entry.remindAt };
  }
}
