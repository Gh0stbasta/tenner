import type { HandlerInput } from "ask-sdk-core";
import type { IntentRequest } from "ask-sdk-model";
import type { Audience } from "../answers.js";
import { loadHousehold } from "../session.js";
import type { AlexaMember } from "../tennerApi.js";
import { memberFromSlot } from "./members.js";

export interface ResolvedAudience {
  readonly audience: Audience;
  readonly members: readonly AlexaMember[];
  /** Member for the dashboard filter (own + shared Tenners), undefined = household-wide. */
  readonly assignedTo: string | undefined;
  /** A member slot was spoken but names nobody in the household. */
  readonly unknownName: string | undefined;
}

/** Whose Tenners: the named member („für Julia“), else the recognized speaker, else the whole household. */
export async function resolveAudience(input: HandlerInput): Promise<ResolvedAudience> {
  const household = await loadHousehold(input);
  const members = household.context.members;
  const spoken = (input.requestEnvelope.request as IntentRequest).intent.slots?.member?.value;
  if (spoken !== undefined && spoken !== "") {
    const named = memberFromSlot(input, "member", members);
    if (named === undefined) return { audience: { kind: "household" }, members, assignedTo: undefined, unknownName: spoken };
    const kind = named.userId === household.speaker?.userId ? "speaker" : "member";
    return { audience: { kind, member: named }, members, assignedTo: named.userId, unknownName: undefined };
  }
  if (household.speaker) return { audience: { kind: "speaker", member: household.speaker }, members, assignedTo: household.speaker.userId, unknownName: undefined };
  return { audience: { kind: "household" }, members, assignedTo: undefined, unknownName: undefined };
}
