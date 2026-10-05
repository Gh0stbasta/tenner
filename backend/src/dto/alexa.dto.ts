import type { UserId } from "../models/index.js";

/** GET /household/alexa (ALEXA-002): everything the skill needs at session start, in one request. */
export interface AlexaContextResponse {
  /** The household member of the calling account (the linked Alexa account or a voice profile's own link). */
  readonly account: { readonly userId: UserId };
  /** Household timezone (IANA) for "today" in the skill, e.g. whether a Tenner is due (ALEXA-004). */
  readonly timezone: string;
  /** Active members (names for speech, dynamic entities and the "Wer spricht gerade?" question). */
  readonly members: readonly AlexaMemberResponse[];
  /** Recognized speakers mapped to members. */
  readonly speakers: readonly AlexaSpeakerResponse[];
}

export interface AlexaMemberResponse {
  readonly userId: UserId;
  readonly displayName: string;
}

export interface AlexaSpeakerResponse {
  readonly personId: string;
  readonly userId: UserId;
}

/** PUT /household/alexa-speakers/{personId} */
export interface LinkAlexaSpeakerRequest {
  readonly userId: UserId;
}
