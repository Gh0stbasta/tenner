/**
 * Alexa as a notification channel (ALEXA-008), for every Alexa account of the household:
 * - OVERDUE_ALERT → Proactive Event AMAZON.MessageAlert.Activated (count only; notification indicator),
 * - DAILY_DIGEST → Alexa reminder via Skill Messaging (spoken at the member's digest time).
 * Other types are skipped. Accounts Amazon rejects are removed; tokens and Amazon IDs are never logged.
 */

import type { DeliveryResult, NotificationChannel, NotificationMessage, Recipient } from "../notifications/model.js";
import type { LwaTokenClient } from "./lwa-client.js";
import { PROACTIVE_EVENTS_SCOPE, type AlexaApiOutcome, type ProactiveEventsClient } from "./proactive-events.js";
import { SKILL_MESSAGING_SCOPE, type SkillMessagingClient } from "./skill-messaging.js";

export interface AlexaChannelDependencies {
  readonly alexaUsers: (tenantId: string) => Promise<readonly string[]>;
  readonly removeAlexaUser: (tenantId: string, alexaUserId: string) => Promise<void>;
  readonly lwa: LwaTokenClient;
  readonly proactiveEvents: ProactiveEventsClient;
  readonly skillMessaging: SkillMessagingClient;
  readonly now: () => Date;
}

/** Reminder text: short, spoken, points to the briefing for details. */
export function reminderText(message: NotificationMessage): string {
  const due = Number(message.facts?.dueToday ?? 0);
  const minutes = Number(message.facts?.minutes ?? 0);
  const overdue = Number(message.facts?.overdue ?? 0);
  const parts = [`Heute ${due} Tenner, ${minutes} Minuten`, ...(overdue > 0 ? [`${overdue} überfällig`] : [])];
  return `Tenner: ${parts.join(", ")}. Sag: Alexa, sag Tenner, starte meinen Tag, für Details.`;
}

export class AlexaChannel implements NotificationChannel {
  readonly type = "ALEXA" as const;

  constructor(private readonly deps: AlexaChannelDependencies) {}

  async send(message: NotificationMessage, recipient: Recipient): Promise<DeliveryResult> {
    if (message.type !== "OVERDUE_ALERT" && message.type !== "DAILY_DIGEST") return { status: "SKIPPED", errorCode: "UNSUPPORTED_TYPE" };
    const users = await this.deps.alexaUsers(recipient.tenantId);
    if (users.length === 0) return { status: "SKIPPED", errorCode: "NO_ALEXA_ACCOUNT" };
    const overdue = message.type === "OVERDUE_ALERT";
    const token = await this.deps.lwa.token(overdue ? PROACTIVE_EVENTS_SCOPE : SKILL_MESSAGING_SCOPE);
    const now = this.deps.now();
    let delivered = 0;
    let lastStatus: number | undefined;
    for (const [index, alexaUserId] of users.entries()) {
      const outcome: AlexaApiOutcome = overdue
        ? await this.deps.proactiveEvents.messageAlert(token, alexaUserId, { referenceId: `${recipient.tenantId}-${recipient.userId}-${now.getTime()}-${index}`, count: Number(message.facts?.overdue ?? 1) }, now)
        : await this.deps.skillMessaging.send(token, alexaUserId, { type: "REMINDER", text: reminderText(message) });
      if (outcome.ok) delivered += 1;
      else {
        lastStatus = outcome.status;
        if (outcome.userGone) await this.deps.removeAlexaUser(recipient.tenantId, alexaUserId);
      }
    }
    return delivered > 0 ? { status: "SENT" } : { status: "FAILED", errorCode: lastStatus === undefined ? "ALEXA_UNREACHABLE" : `ALEXA_HTTP_${lastStatus}` };
  }
}
