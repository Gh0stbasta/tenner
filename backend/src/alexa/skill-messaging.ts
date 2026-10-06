/**
 * Skill Messaging (ALEXA-008): wakes the skill Lambda outside a session (Messaging.MessageReceived), which then
 * creates an Alexa reminder with its in-request API token — the only way to create reminders out of session.
 */

import { postJson, type AlexaApiOutcome } from "./proactive-events.js";

export const SKILL_MESSAGING_SCOPE = "alexa:skill_messaging";
const MESSAGE_TTL_SECONDS = 3600;

/** Message to the skill; mirrors alexa/src/handlers/messaging.ts. */
export interface ReminderMessage {
  readonly type: "REMINDER";
  /** Spoken by the reminder, e.g. „Tenner: Heute 4 Tenner, 40 Minuten …“. */
  readonly text: string;
}

export interface SkillMessagingClient {
  send(token: string, alexaUserId: string, message: ReminderMessage): Promise<AlexaApiOutcome>;
}

export function createSkillMessagingClient(apiEndpoint: string, fetchImpl: typeof fetch): SkillMessagingClient {
  return {
    send(token, alexaUserId, message) {
      return postJson(fetchImpl, `${apiEndpoint}/v1/skillmessages/users/${encodeURIComponent(alexaUserId)}`, token, { data: message, expiresAfterSeconds: MESSAGE_TTL_SECONDS });
    },
  };
}
