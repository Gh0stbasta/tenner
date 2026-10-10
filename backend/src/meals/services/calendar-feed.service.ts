/**
 * Calendar subscription (FOOD-015): one feed token per household. The token is `<tenantId>.<43 chars base64url>`
 * (256 random bits); only its SHA-256 hash is stored (`CALENDAR` item). Creating a new token replaces the old one;
 * revoking clears it. An unknown, malformed or revoked token is 404, without telling which.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Identity } from "../../auth/index.js";
import { NotFoundError } from "../../exceptions/index.js";
import { toUtcTimestamp, type Clock } from "../../utils/clock.js";
import { buildMealCalendar } from "../calendar.js";
import { itemKey } from "../keys.js";
import type { FoodProfile } from "../models/profile.js";
import type { MealPlanResponse } from "../models/plan.js";
import type { MealsStore } from "../repositories/meals-store.js";

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{43})$/;
const KEY = itemKey("CALENDAR");

export interface CalendarFeedStatus {
  readonly active: boolean;
  readonly createdAt: string | null;
}

export interface CalendarFeedDependencies {
  readonly store: MealsStore;
  readonly planOf: (tenantId: string, week: "current" | "next") => Promise<MealPlanResponse>;
  readonly profileOf: (tenantId: string) => Promise<Pick<FoodProfile, "household">>;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  readonly clock: Clock;
  readonly random?: (bytes: number) => Buffer;
}

const hashOf = (secret: string): string => createHash("sha256").update(secret).digest("hex");

export class CalendarFeedService {
  constructor(private readonly deps: CalendarFeedDependencies) {}

  async status(tenantId: string): Promise<CalendarFeedStatus> {
    const data = (await this.deps.store.get(tenantId, KEY))?.data;
    const active = typeof data?.tokenHash === "string";
    return { active, createdAt: active && typeof data?.createdAt === "string" ? data.createdAt : null };
  }

  /** A new token (shown once); the previous one stops working. */
  async createToken(identity: Identity): Promise<{ readonly token: string; readonly createdAt: string }> {
    const secret = (this.deps.random ?? randomBytes)(32).toString("base64url");
    const createdAt = toUtcTimestamp(this.deps.clock());
    const stored = await this.deps.store.get(identity.tenantId, KEY);
    await this.deps.store.put(identity.tenantId, KEY, { tokenHash: hashOf(secret), createdAt, createdBy: identity.userId }, stored?.version);
    return { token: `${identity.tenantId}.${secret}`, createdAt };
  }

  async revoke(identity: Identity): Promise<void> {
    const stored = await this.deps.store.get(identity.tenantId, KEY);
    if (!stored) return;
    await this.deps.store.put(identity.tenantId, KEY, { revokedAt: toUtcTimestamp(this.deps.clock()), revokedBy: identity.userId }, stored.version);
  }

  /** The ICS text for a valid token; 404 otherwise. */
  async feed(token: string): Promise<string> {
    const match = TOKEN_PATTERN.exec(token);
    if (!match) throw new NotFoundError("Calendar not found.");
    const [, tenantId, secret] = match as unknown as [string, string, string];
    const stored = (await this.deps.store.get(tenantId, KEY))?.data;
    const expected = typeof stored?.tokenHash === "string" ? Buffer.from(stored.tokenHash, "hex") : undefined;
    const actual = Buffer.from(hashOf(secret), "hex");
    if (!expected || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new NotFoundError("Calendar not found.");
    const [current, next, profile, timeZone] = await Promise.all([
      this.deps.planOf(tenantId, "current"),
      this.deps.planOf(tenantId, "next"),
      this.deps.profileOf(tenantId),
      this.deps.timezoneOf(tenantId),
    ]);
    return buildMealCalendar({ slots: [...current.slots, ...next.slots], mealTimes: profile.household.mealTimes, timeZone, now: this.deps.clock() });
  }
}
