import type { HandlerInput } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SKILL_TITLE, esc } from "../speech.js";

export const FOLLOW_UP = "Was möchtest du noch wissen?";
export const CONTINUE_REPROMPT = "Soll ich weiterlesen? Sag ja oder nein.";

const LISTING_ATTRIBUTE = "listing";

/**
 * Speak a plain-text answer (escaped for SSML) and show it as a card. A one-shot request („Alexa, frag Familien Zentrale, …“)
 * ends the session; inside an open session Tenner waits for the next question. `question` keeps the session open
 * with that reprompt (e.g. a listing continuation). Voice only: the skill shows no APL views (MAINT-006).
 */
export function answer(input: HandlerInput, text: string, question?: string): Response {
  const builder = input.responseBuilder.speak(esc(text)).withSimpleCard(SKILL_TITLE, text);
  if (question !== undefined) return builder.reprompt(esc(question)).getResponse();
  if (input.requestEnvelope.session?.new !== false) return builder.withShouldEndSession(true).getResponse();
  return builder.reprompt(FOLLOW_UP).getResponse();
}

/** Remember the unread items of a listing for „ja“ / „nein“. */
export function setListing(input: HandlerInput, items: readonly string[]): void {
  const session = Object.fromEntries(Object.entries(input.attributesManager.getSessionAttributes()).filter(([key]) => key !== LISTING_ATTRIBUTE));
  input.attributesManager.setSessionAttributes(items.length > 0 ? { ...session, [LISTING_ATTRIBUTE]: items } : session);
}

export function listingOf(input: HandlerInput): readonly string[] {
  const items = input.attributesManager.getSessionAttributes()[LISTING_ATTRIBUTE] as unknown;
  return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
}
