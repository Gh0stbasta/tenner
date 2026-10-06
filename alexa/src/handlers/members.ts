import type { HandlerInput } from "ask-sdk-core";
import type { Directive, IntentRequest } from "ask-sdk-model";
import type { AlexaMember } from "../tennerApi.js";
import { findMemberByName } from "../session.js";

export const MEMBER_SLOT_TYPE = "TennerMember";
export const TITLE_SLOT_TYPE = "TennerTitle";
/** Alexa accepts at most 100 dynamic values per slot type and update. */
export const MAX_DYNAMIC_VALUES = 100;
const ARTICLE_PREFIX = /^(der|die|das|den|dem|ein|eine|einen)\s+/i;
const ER_SUCCESS_MATCH = "ER_SUCCESS_MATCH";

/**
 * Teach Alexa the household's member names (TennerMember, ids = userIds) and Tenner titles (TennerTitle, ids =
 * tennerIds, synonym without a leading article) for this session.
 */
export function entitiesDirective(members: readonly AlexaMember[], tenners: readonly { tennerId: string; title: string }[] = []): Directive {
  const titleValues = tenners.slice(0, MAX_DYNAMIC_VALUES).map((tenner) => {
    const withoutArticle = tenner.title.replace(ARTICLE_PREFIX, "").toLowerCase();
    return { id: tenner.tennerId, name: { value: tenner.title, synonyms: withoutArticle !== tenner.title.toLowerCase() ? [withoutArticle] : [] } };
  });
  return {
    type: "Dialog.UpdateDynamicEntities",
    updateBehavior: "REPLACE",
    types: [
      { name: MEMBER_SLOT_TYPE, values: members.map((member) => ({ id: member.userId, name: { value: member.displayName, synonyms: [] } })) },
      ...(titleValues.length > 0 ? [{ name: TITLE_SLOT_TYPE, values: titleValues }] : []),
    ],
  };
}

/** The member named in a TennerMember slot: entity resolution ID first, then a name match. */
export function memberFromSlot(input: HandlerInput, slotName: string, members: readonly AlexaMember[]): AlexaMember | undefined {
  const slot = (input.requestEnvelope.request as IntentRequest).intent.slots?.[slotName];
  if (slot === undefined) return undefined;
  for (const authority of slot.resolutions?.resolutionsPerAuthority ?? []) {
    if (authority.status.code !== ER_SUCCESS_MATCH) continue;
    const id = authority.values[0]?.value.id;
    const member = members.find((candidate) => candidate.userId === id);
    if (member) return member;
  }
  return slot.value === undefined ? undefined : findMemberByName(members, slot.value);
}
