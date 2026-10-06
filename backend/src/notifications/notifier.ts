/**
 * Notifier run (NOTIFICATION-001): for every household member and job, decide whether the job is due now, render
 * the message once and deliver it through each of the member's channels. Failures of one member, job or channel
 * never stop the others.
 */

import type { HouseholdMember } from "../models/index.js";
import type { Logger } from "../utils/logger.js";
import { deliver, type DeliveryContext } from "./delivery.js";
import { notificationKey, type ChannelType, type DeliveryStatus, type NotificationChannel, type NotificationMessage, type NotificationType, type Recipient } from "./model.js";
import { localTime } from "./schedule.js";

/** A notification content type (daily digest, overdue alerts, …), added by NOTIFICATION-003/004. */
export interface NotificationJob {
  readonly type: NotificationType;
  /** Channels the recipient wants for this job, or [] when the job is not due now (time, quiet hours, disabled). */
  channelsDue(recipient: Recipient, now: Date): Promise<readonly ChannelType[]>;
  /** The message, or undefined when there is nothing to say (e.g. an empty day). */
  render(recipient: Recipient, now: Date): Promise<NotificationMessage | undefined>;
  /** Extra dedup key part (e.g. overdue cycle); default: one per day. */
  dedupSuffix?(message: NotificationMessage): string | undefined;
}

export interface NotifierDependencies extends DeliveryContext {
  readonly tenantId: string;
  readonly members: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  readonly jobs: readonly NotificationJob[];
  readonly channels: readonly NotificationChannel[];
  readonly logger: Logger;
}

export interface RunSummary {
  readonly recipients: number;
  readonly deliveries: Readonly<Record<DeliveryStatus, number>>;
  readonly errors: number;
}

export async function runNotifier(deps: NotifierDependencies): Promise<RunSummary> {
  const now = deps.now();
  const deliveries: Record<DeliveryStatus, number> = { SENT: 0, FAILED: 0, SKIPPED: 0 };
  let errors = 0;
  const timezone = await deps.timezoneOf(deps.tenantId);
  const members = (await deps.members(deps.tenantId)).filter((member) => member.active);
  for (const member of members) {
    const recipient: Recipient = { tenantId: deps.tenantId, userId: member.userId, displayName: member.displayName, timezone };
    for (const job of deps.jobs) {
      try {
        const wanted = await job.channelsDue(recipient, now);
        const channels = deps.channels.filter((channel) => wanted.includes(channel.type));
        if (channels.length === 0) continue;
        const message = await job.render(recipient, now);
        if (message === undefined) continue;
        const date = localTime(now, timezone).date;
        for (const channel of channels) {
          const suffix = job.dedupSuffix?.(message);
          const key = notificationKey({ tenantId: deps.tenantId, userId: member.userId, type: job.type, channel: channel.type, date, ...(suffix === undefined ? {} : { suffix }) });
          const result = await deliver(deps, key, message, recipient, channel);
          deliveries[result.status] += 1;
        }
      } catch (error) {
        errors += 1;
        deps.logger.error("Notification job failed", { event: "NotificationJobFailed", type: job.type, userId: member.userId, error: error instanceof Error ? error.name : "UnknownError" });
      }
    }
  }
  const summary = { recipients: members.length, deliveries, errors };
  deps.logger.info("Notifier run finished", { event: "NotifierRun", ...summary });
  return summary;
}
