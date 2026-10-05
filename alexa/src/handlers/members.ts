import type { HandlerInput } from "ask-sdk-core";
import type { Directive, IntentRequest } from "ask-sdk-model";
import type { AlexaMember } from "../tennerApi.js";
import { findMemberByName } from "../session.js";

export const MEMBER_SLOT_TYPE = "TennerMember";
const ER_SUCCESS_MATCH = "ER_SUCCESS_MATCH";

/** Teach Alexa the household's member names for this session (slot type TennerMember, ids = userIds). */
export function memberEntitiesDirective(members: readonly AlexaMember[]): Directive {
  return {
    type: "Dialog.UpdateDynamicEntities",
    updateBehavior: "REPLACE",
    types: [{ name: MEMBER_SLOT_TYPE, values: members.map((member) => ({ id: member.userId, name: { value: member.displayName, synonyms: [] } })) }],
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
