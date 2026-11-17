/**
 * Shopping list by voice (FOOD-026): „setz Milch auf die Einkaufsliste“, „was steht auf der Einkaufsliste“,
 * „ich habe Milch gekauft“. The list is the household's list in the app (FOOD-014). An ambiguous name is answered
 * with the options, without guessing; the user repeats the phrase with the right name.
 * MAINT-018: the item alone („sag Mary Poppins Milch“), up to five items in one sentence, and a shopping mode
 * („sag Mary Poppins Einkauf“) that asks „Noch etwas?“ until „nein“ / „fertig“.
 */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { IntentRequest, Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { apiOf } from "../session.js";
import { addItems, checkItem, fetchShoppingList, itemName, matchItem, readAnswer, sameOpenItem, spokenNames, type ShoppingItem } from "../shopping.js";
import { joinAlternatives } from "../speech.js";
import { TennerApiError } from "../tennerApi.js";
import { isIntent } from "./intentRequest.js";
import { answer } from "./respond.js";
import { dialogStateOf, setDialogState } from "./state.js";

export const SHOPPING_SPEECH = {
  whatToAdd: "Sag zum Beispiel: Setz Milch auf die Einkaufsliste.",
  added: (names: readonly string[]): string => `Okay, ${joinAlternatives(names, "und")} ${names.length === 1 ? "steht" : "stehen"} auf der Einkaufsliste.`,
  alreadyThere: (names: readonly string[]): string => `${joinAlternatives(names, "und")} ${names.length === 1 ? "steht" : "stehen"} schon auf der Einkaufsliste.`,
  modeStart: "Was soll auf die Einkaufsliste?",
  modeReprompt: "Sag einfach, was auf die Liste soll, zum Beispiel Milch und Eier. Oder sag fertig.",
  more: "Noch etwas?",
  modeEnd: "Alles klar, die Einkaufsliste ist aktuell.",
  noList: "Für diese Woche gibt es noch keinen Essensplan und deshalb noch keine Einkaufsliste. Leg den Plan in der App an.",
  whichItem: "Sag zum Beispiel: Ich habe Milch gekauft.",
  bought: (name: string): string => `Okay, ${name} ist abgehakt.`,
  notOnList: (spoken: string): string => `${spoken} steht nicht auf der Einkaufsliste.`,
  ambiguous: (names: readonly string[]): string => `Meinst du ${joinAlternatives(names)}? Sag zum Beispiel: Ich habe ${names[0] ?? ""} gekauft.`,
} as const;

const spokenItem = (input: HandlerInput): string | undefined => {
  const value = (input.requestEnvelope.request as IntentRequest).intent.slots?.item?.value?.trim();
  return value ? value : undefined;
};

/** The week has no plan yet (404): there is no list to change. Other API errors go to the error handler. */
async function withList(input: HandlerInput, action: (items: readonly ShoppingItem[]) => Promise<Response>): Promise<Response> {
  let items: readonly ShoppingItem[];
  try {
    items = await fetchShoppingList(apiOf(input));
  } catch (error) {
    if (error instanceof TennerApiError && error.kind === "NOT_FOUND") return answer(input, SHOPPING_SPEECH.noList);
    throw error;
  }
  return action(items);
}

const SLOT_NAMES = ["item", "itemA", "itemB", "itemC", "itemD", "itemE"] as const;

/** All spoken items of the request (MAINT-018: up to five slots plus the free-text slot). */
const spokenItems = (input: HandlerInput): string[] => {
  const slots = (input.requestEnvelope.request as IntentRequest).intent.slots;
  return spokenNames(SLOT_NAMES.map((name) => slots?.[name]?.value));
};

const inShoppingMode = (input: HandlerInput): boolean => dialogStateOf(input) === "SHOPPING";

/** In the shopping mode every answer asks „Noch etwas?“; elsewhere the usual one-shot rules apply. */
const reply = (input: HandlerInput, text: string): Response =>
  inShoppingMode(input) ? answer(input, `${text} ${SHOPPING_SPEECH.more}`, SHOPPING_SPEECH.modeReprompt) : answer(input, text);

export const AddShoppingItemIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AddShoppingItemIntent"),
  handle(input: HandlerInput): Promise<Response> | Response {
    const names = spokenItems(input);
    if (names.length === 0) return inShoppingMode(input) ? answer(input, SHOPPING_SPEECH.modeReprompt, SHOPPING_SPEECH.modeReprompt) : answer(input, SHOPPING_SPEECH.whatToAdd);
    return withList(input, async (items) => {
      const existing = names.flatMap((name) => sameOpenItem(items, name)?.name ?? []);
      const fresh = names.filter((name) => sameOpenItem(items, name) === undefined);
      if (fresh.length > 0) {
        await addItems(apiOf(input), input.requestEnvelope.request.requestId, fresh);
        logEvent("info", "shopping_item_added", { requestId: input.requestEnvelope.request.requestId, count: fresh.length });
      }
      const parts = [fresh.length > 0 ? SHOPPING_SPEECH.added(fresh) : "", existing.length > 0 ? SHOPPING_SPEECH.alreadyThere(existing) : ""];
      return reply(input, parts.filter(Boolean).join(" "));
    });
  },
};

/** „sag Mary Poppins Einkauf“ (MAINT-018): keeps listening for items until „nein“ / „fertig“. */
export const ShoppingModeIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "ShoppingModeIntent"),
  handle(input: HandlerInput): Response {
    setDialogState(input, "SHOPPING");
    return answer(input, SHOPPING_SPEECH.modeStart, SHOPPING_SPEECH.modeReprompt);
  },
};

const slotValueOf = (input: HandlerInput, name: string): string | undefined => (input.requestEnvelope.request as IntentRequest).intent.slots?.[name]?.value?.trim() || undefined;

/**
 * „nein“, „fertig“, „das war's“ end the shopping mode; outside of it „das war's“ just closes the session. „fertig“
 * alone is a CompleteIntent sample (ALEXA-004), so the mode also takes a CompleteIntent without a task name.
 */
export const ShoppingDoneIntentHandler: RequestHandler = {
  canHandle: (input) =>
    isIntent(input, "ShoppingDoneIntent") ||
    (inShoppingMode(input) && (isIntent(input, "AMAZON.NoIntent") || (isIntent(input, "CompleteIntent") && slotValueOf(input, "tenner") === undefined))),
  handle(input: HandlerInput): Response {
    setDialogState(input, undefined);
    return input.responseBuilder.speak(SHOPPING_SPEECH.modeEnd).withShouldEndSession(true).getResponse();
  },
};

/**
 * In the shopping mode a single word can also land on the other slot-only samples ({tenner}, {member}); it is taken
 * as an item there.
 */
export const ShoppingSlotOnlyHandler: RequestHandler = {
  canHandle: (input) =>
    inShoppingMode(input) &&
    ((isIntent(input, "CompleteIntent") && slotValueOf(input, "tenner") !== undefined) || (isIntent(input, "SpeakerIntent") && slotValueOf(input, "member") !== undefined)),
  handle(input: HandlerInput): Promise<Response> | Response {
    const value = slotValueOf(input, "tenner") ?? slotValueOf(input, "member") ?? "";
    const request = input.requestEnvelope.request as IntentRequest;
    request.intent.slots = { item: { name: "item", value, confirmationStatus: "NONE" } };
    return AddShoppingItemIntentHandler.handle(input);
  },
};

/** An utterance Alexa could not place, during the shopping mode: ask again instead of the general fallback. */
export const ShoppingFallbackHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AMAZON.FallbackIntent") && inShoppingMode(input),
  handle: (input) => answer(input, `Das habe ich nicht verstanden. ${SHOPPING_SPEECH.modeReprompt}`, SHOPPING_SPEECH.modeReprompt),
};

export const ReadShoppingListIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "ReadShoppingListIntent"),
  handle: (input) => withList(input, async (items) => answer(input, readAnswer(items))),
};

export const ShoppingItemBoughtIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "ShoppingItemBoughtIntent"),
  handle(input: HandlerInput): Promise<Response> | Response {
    const spoken = spokenItem(input);
    if (spoken === undefined) return answer(input, SHOPPING_SPEECH.whichItem);
    return withList(input, async (items) => {
      const match = matchItem(spoken, items);
      if (match.kind === "none") return answer(input, SHOPPING_SPEECH.notOnList(itemName(spoken)));
      if (match.kind === "ambiguous") return answer(input, SHOPPING_SPEECH.ambiguous(match.options.map((item) => item.name)));
      await checkItem(apiOf(input), match.item.key);
      logEvent("info", "shopping_item_checked", { requestId: input.requestEnvelope.request.requestId });
      return answer(input, SHOPPING_SPEECH.bought(match.item.name));
    });
  },
};
