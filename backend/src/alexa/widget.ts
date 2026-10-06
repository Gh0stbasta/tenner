/**
 * Echo Show home-screen widget (ALEXA-007): a small household summary pushed with the Data Store API after every
 * change (debounced to one push per minute) and at the start of each household day. The widget renders from the
 * pushed data only; it never calls the skill.
 */

import type { DashboardRequest, DashboardResponse } from "../dto/index.js";
import type { HouseholdMember } from "../models/index.js";
import { deliveryRecord, type DeliveryLog } from "../notifications/delivery.js";
import { localTime } from "../notifications/schedule.js";
import type { Logger } from "../utils/logger.js";
import { DATASTORE_SCOPE, type DataStoreClient } from "./datastore-client.js";
import type { LwaTokenClient } from "./lwa-client.js";

export const DEBOUNCE_MS = 60_000;
export const WIDGET_NEXT_ITEMS = 2;

export interface WidgetSummary {
  readonly date: string;
  readonly dueToday: number;
  readonly openMinutes: number;
  readonly overdue: number;
  readonly next: readonly { readonly title: string; readonly minutes: number; readonly member: string }[];
  readonly members: readonly { readonly name: string; readonly count: number }[];
  readonly updatedAt: string;
}

/** Payload for the widget: counts, next two Tenners (overdue first), per-member counts. No IDs. */
export function widgetSummary(dashboard: DashboardResponse, members: readonly HouseholdMember[], now: Date): WidgetSummary {
  const nameOf = (userId: string) => (userId === "HOUSEHOLD" ? "Alle" : (members.find((member) => member.userId === userId)?.displayName ?? userId));
  const next = [...dashboard.overdue, ...dashboard.dueToday].slice(0, WIDGET_NEXT_ITEMS);
  return {
    date: dashboard.referenceDate,
    dueToday: dashboard.summary.dueTodayCount,
    openMinutes: dashboard.summary.totalActionableMinutes,
    overdue: dashboard.summary.overdueCount,
    next: next.map((tenner) => ({ title: tenner.title, minutes: tenner.estimatedMinutes, member: nameOf(tenner.assignedTo) })),
    members: members
      .filter((member) => member.active)
      .map((member) => ({ name: member.displayName, count: dashboard.byUser[member.userId]?.count ?? 0 }))
      .filter((entry) => entry.count > 0),
    updatedAt: now.toISOString(),
  };
}

export interface WidgetPushDependencies {
  readonly alexaUsers: (tenantId: string) => Promise<readonly string[]>;
  readonly removeAlexaUser: (tenantId: string, alexaUserId: string) => Promise<void>;
  readonly dashboard: (tenantId: string, request: DashboardRequest) => Promise<DashboardResponse>;
  readonly members: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  readonly lwa: LwaTokenClient;
  readonly dataStore: DataStoreClient;
  readonly log: Pick<DeliveryLog, "get" | "mark">;
  readonly logger: Logger;
  readonly now: () => Date;
}

const lastKey = (tenantId: string) => `${tenantId}#WIDGET#LAST`;
const dirtyKey = (tenantId: string) => `${tenantId}#WIDGET#DIRTY`;

export class WidgetPushService {
  constructor(private readonly deps: WidgetPushDependencies) {}

  /** A household change (API write): push now, or mark dirty when the last push was less than a minute ago. */
  async onChange(tenantId: string): Promise<void> {
    const now = this.deps.now();
    const last = await this.deps.log.get(lastKey(tenantId));
    if (last && now.getTime() - Date.parse(last.createdAt) < DEBOUNCE_MS) {
      await this.mark(dirtyKey(tenantId), tenantId, now);
      this.deps.logger.debug("Widget push debounced", { event: "WidgetPushDebounced" });
      return;
    }
    await this.push(tenantId, now, "CHANGE");
  }

  /** Scheduled run: push at the start of a new household day, or when a debounced change is still pending. */
  async onSchedule(tenantId: string): Promise<void> {
    const now = this.deps.now();
    const timezone = await this.deps.timezoneOf(tenantId);
    const last = await this.deps.log.get(lastKey(tenantId));
    const dirty = await this.deps.log.get(dirtyKey(tenantId));
    const newDay = last === undefined || localTime(new Date(last.createdAt), timezone).date !== localTime(now, timezone).date;
    const pending = dirty !== undefined && (last === undefined || Date.parse(dirty.createdAt) > Date.parse(last.createdAt));
    if (newDay || pending) await this.push(tenantId, now, newDay ? "DAY_START" : "PENDING_CHANGE");
  }

  private async push(tenantId: string, now: Date, reason: string): Promise<void> {
    const users = await this.deps.alexaUsers(tenantId);
    if (users.length === 0) return;
    const [dashboard, members] = await Promise.all([this.deps.dashboard(tenantId, {}), this.deps.members(tenantId)]);
    const content = widgetSummary(dashboard, members, now);
    const token = await this.deps.lwa.token(DATASTORE_SCOPE);
    let pushed = 0;
    for (const alexaUserId of users) {
      let outcome = await this.deps.dataStore.putWidgetData(token, alexaUserId, content);
      if (!outcome.ok && !outcome.userGone) outcome = await this.deps.dataStore.putWidgetData(token, alexaUserId, content); // retry once
      if (outcome.ok) {
        pushed += 1;
      } else if (outcome.userGone) {
        await this.deps.removeAlexaUser(tenantId, alexaUserId);
        this.deps.logger.info("Alexa user removed from widget targets", { event: "WidgetTargetRemoved", status: outcome.status });
      } else {
        this.deps.logger.warn("Widget push failed", { event: "WidgetPushFailed", status: outcome.status });
      }
    }
    await this.mark(lastKey(tenantId), tenantId, now);
    this.deps.logger.info("Widget pushed", { event: "WidgetPushed", reason, targets: users.length, pushed });
  }

  private async mark(key: string, tenantId: string, now: Date): Promise<void> {
    await this.deps.log.mark(deliveryRecord(key, { type: "WIDGET", channel: "ALEXA", userId: tenantId }, now, "SENT"));
  }
}
