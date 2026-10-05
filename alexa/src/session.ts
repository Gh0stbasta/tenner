/**
 * Linked account, Tenner API client and speaker → member resolution for one request (ALEXA-002).
 *
 * Token choice: a recognized voice profile with its own linked account (context.System.person.accessToken) acts as
 * that person; otherwise the account's link (context.System.user.accessToken) is used. The household context
 * (account member, active members, speaker mappings) is loaded once per session and kept in session attributes.
 */

import type { HandlerInput, RequestInterceptor } from "ask-sdk-core";
import type { RequestEnvelope } from "ask-sdk-model";
import type { SkillConfig } from "./config.js";
import { createTennerApi, type AlexaContext, type AlexaMember, type TennerApi } from "./tennerApi.js";

export interface Link {
  readonly token: string;
  /** Recognized speaker, if voice personalization is enabled and the permission granted. */
  readonly personId: string | undefined;
  /** True when the token is the recognized person's own link. */
  readonly personLinked: boolean;
}

/** No linked token: the handler answers with the "please link" prompt. */
export class NotLinkedError extends Error {
  constructor() {
    super("Account not linked");
    this.name = "NotLinkedError";
  }
}

export function linkOf(envelope: RequestEnvelope): Link | undefined {
  const system = envelope.context?.System;
  const personToken = system?.person?.accessToken;
  const token = personToken ?? system?.user.accessToken;
  if (token === undefined || token === "") return undefined;
  return { token, personId: system?.person?.personId, personLinked: personToken !== undefined };
}

interface RequestState {
  link?: Link;
  api?: TennerApi;
}

/** Resolves the link and builds the API client before every request. */
export function linkInterceptor(config: SkillConfig, fetchImpl: typeof fetch): RequestInterceptor {
  return {
    process(input: HandlerInput): void {
      const link = linkOf(input.requestEnvelope);
      const state: RequestState = input.attributesManager.getRequestAttributes();
      if (link === undefined) return;
      state.link = link;
      state.api = createTennerApi({
        baseUrl: config.tennerApiBaseUrl,
        token: link.token,
        correlationId: input.requestEnvelope.request.requestId,
        timeoutMs: config.apiTimeoutMs,
        fetch: fetchImpl,
      });
    },
  };
}

export function apiOf(input: HandlerInput): TennerApi {
  const api = (input.attributesManager.getRequestAttributes() as RequestState).api;
  if (api === undefined) throw new NotLinkedError();
  return api;
}

export function requireLink(input: HandlerInput): Link {
  const link = (input.attributesManager.getRequestAttributes() as RequestState).link;
  if (link === undefined) throw new NotLinkedError();
  return link;
}

export interface Household {
  readonly context: AlexaContext;
  /** The member who is speaking, or undefined (unrecognized speaker → household-wide answers). */
  readonly speaker: AlexaMember | undefined;
  /** A recognized voice that is not mapped to a member yet: ask „Wer spricht gerade?“ once. */
  readonly unknownSpeaker: boolean;
}

const HOUSEHOLD_ATTRIBUTE = "household";

/** Household context for this session (one API call per session), with the speaking member resolved. */
export async function loadHousehold(input: HandlerInput): Promise<Household> {
  const link = requireLink(input);
  const session = input.attributesManager.getSessionAttributes();
  let context = session[HOUSEHOLD_ATTRIBUTE] as AlexaContext | undefined;
  if (context === undefined) {
    context = await apiOf(input).alexaContext();
    rememberHousehold(input, context);
  }
  return { context, ...resolveSpeaker(context, link) };
}

export function rememberHousehold(input: HandlerInput, context: AlexaContext): void {
  input.attributesManager.setSessionAttributes({ ...input.attributesManager.getSessionAttributes(), [HOUSEHOLD_ATTRIBUTE]: context });
}

export function resolveSpeaker(context: AlexaContext, link: Link): Pick<Household, "speaker" | "unknownSpeaker"> {
  const memberOf = (userId: string | undefined) => context.members.find((member) => member.userId === userId);
  if (link.personLinked) return { speaker: memberOf(context.account.userId), unknownSpeaker: false };
  if (link.personId === undefined) return { speaker: undefined, unknownSpeaker: false };
  const mapped = context.speakers.find((speaker) => speaker.personId === link.personId);
  const speaker = memberOf(mapped?.userId);
  return { speaker, unknownSpeaker: speaker === undefined };
}

/** Case- and accent-insensitive name match for spoken member names. */
export function findMemberByName(members: readonly AlexaMember[], spoken: string): AlexaMember | undefined {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
  const wanted = normalize(spoken);
  return members.find((member) => normalize(member.displayName) === wanted || member.userId.toLowerCase() === wanted);
}
