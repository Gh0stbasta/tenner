/**
 * Alexa context and speaker mappings (ALEXA-002). The skill calls the API like any household member; this service
 * only answers "who is the account, who are the members, which voice profile is which member" and keeps the
 * personId → member mapping on the household item.
 */

import type { Identity } from "../auth/index.js";
import type { AlexaContextResponse } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { MAX_ALEXA_SPEAKERS, SEED_MEMBERS, type AlexaSpeaker, type HouseholdSettings, type UserId } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";

export class AlexaSpeakerService {
  constructor(
    private readonly households: Pick<HouseholdRepository, "get" | "saveAlexaSpeakers">,
    private readonly clock: Clock,
  ) {}

  async context(identity: Identity): Promise<AlexaContextResponse> {
    return toContext(identity, await this.households.get(identity.tenantId));
  }

  /**
   * Map a recognized speaker to an active member (any member may do this, like other household settings).
   * An existing mapping of the same speaker is replaced; repeating the same request changes nothing.
   */
  async link(identity: Identity, personId: string, userId: UserId): Promise<AlexaContextResponse> {
    const settings = await this.households.get(identity.tenantId);
    const members = settings?.members ?? SEED_MEMBERS;
    if (!members.some((member) => member.userId === userId && member.active)) {
      throw new ValidationError("Invalid speaker mapping.", [{ field: "userId", message: "Must be an active household member." }]);
    }
    const speakers = settings?.alexaSpeakers ?? [];
    if (speakers.some((speaker) => speaker.personId === personId && speaker.userId === userId)) return toContext(identity, settings);
    const others = speakers.filter((speaker) => speaker.personId !== personId);
    if (others.length >= MAX_ALEXA_SPEAKERS) throw new ConflictError(`At most ${MAX_ALEXA_SPEAKERS} speakers can be mapped.`, "LIMIT_REACHED");
    const timestamp = toUtcTimestamp(this.clock());
    const speaker: AlexaSpeaker = { personId, userId, createdAt: timestamp, createdBy: identity.userId };
    const saved = await this.households.saveAlexaSpeakers(identity.tenantId, [...others, speaker], settings?.alexaSpeakersVersion ?? 0, identity.userId, timestamp);
    return toContext(identity, saved);
  }

  /** Remove a speaker mapping (Settings → Alexa); 404 if there is none. */
  async unlink(identity: Identity, personId: string): Promise<AlexaContextResponse> {
    const settings = await this.households.get(identity.tenantId);
    const speakers = settings?.alexaSpeakers ?? [];
    if (!settings || !speakers.some((speaker) => speaker.personId === personId)) throw new NotFoundError("Speaker mapping not found.");
    const timestamp = toUtcTimestamp(this.clock());
    const saved = await this.households.saveAlexaSpeakers(
      identity.tenantId,
      speakers.filter((speaker) => speaker.personId !== personId),
      settings.alexaSpeakersVersion,
      identity.userId,
      timestamp,
    );
    return toContext(identity, saved);
  }
}

function toContext(identity: Identity, settings: HouseholdSettings | undefined): AlexaContextResponse {
  const members = (settings?.members ?? SEED_MEMBERS).filter((member) => member.active);
  return {
    account: { userId: identity.userId },
    members: members.map((member) => ({ userId: member.userId, displayName: member.displayName })),
    // Mappings to members deactivated meanwhile are hidden (and ignored by the skill) until removed.
    speakers: (settings?.alexaSpeakers ?? [])
      .filter((speaker) => members.some((member) => member.userId === speaker.userId))
      .map((speaker) => ({ personId: speaker.personId, userId: speaker.userId })),
  };
}
