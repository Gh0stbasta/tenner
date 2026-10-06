import type { UserId } from "./enums.js";

/**
 * Alexa voice profile → household member (ALEXA-002). `personId` is Amazon's opaque, skill-specific ID of a
 * recognized speaker (`context.System.person.personId`); it carries no personal data and is stored only here.
 */
export interface AlexaSpeaker {
  readonly personId: string;
  readonly userId: UserId;
  readonly createdAt: string;
  readonly createdBy: UserId;
}

/** Amazon person IDs, e.g. amzn1.ask.person.ABC123 (length-limited, no whitespace). */
export const ALEXA_PERSON_ID_PATTERN = /^amzn1\.ask\.person\.[A-Za-z0-9._-]{1,200}$/;

/** At most one mapping per speaker; a household has only a few voice profiles. */
export const MAX_ALEXA_SPEAKERS = 20;

/**
 * An Alexa account (context.System.user.userId) that uses the linked skill (ALEXA-007): target of widget pushes and
 * Alexa notifications. Opaque Amazon identifier; never logged.
 */
export interface AlexaUser {
  readonly alexaUserId: string;
  /** Member whose Cognito account the Alexa account is linked to. */
  readonly linkedBy: UserId;
  readonly createdAt: string;
}

export const ALEXA_USER_ID_PATTERN = /^amzn1\.ask\.account\.[A-Za-z0-9._-]{1,500}$/;
export const MAX_ALEXA_USERS = 10;
