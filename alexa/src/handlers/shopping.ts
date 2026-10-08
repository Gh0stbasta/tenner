/**
 * Shopping list by voice (FOOD-026): „setz Milch auf die Einkaufsliste“, „was steht auf der Einkaufsliste“,
 * „ich habe Milch gekauft“. The list is the household's list in the app (FOOD-014). An ambiguous name is answered
 * with the options, without guessing; the user repeats the phrase with the right name.
 */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { IntentRequest, Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { apiOf } from "../session.js";
import { addItem, checkItem, fetchShoppingList, itemName, matchItem, readAnswer, sameOpenItem, type ShoppingItem } from "../shopping.js";
import { joinAlternatives } from "../speech.js";
import { TennerApiError } from "../tennerApi.js";
import { isIntent } from "./intentRequest.js";
import { answer } from "./respond.js";

export const SHOPPING_SPEECH = {
  whatToAdd: "Sag zum Beispiel: Setz Milch auf die Einkaufsliste.",
  added: (name: string): string => `Okay, ${name} steht auf der Einkaufsliste.`,
  alreadyThere: (name: string): string => `${name} steht schon auf der Einkaufsliste.`,
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

export const AddShoppingItemIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AddShoppingItemIntent"),
  handle(input: HandlerInput): Promise<Response> | Response {
    const spoken = spokenItem(input);
    if (spoken === undefined) return answer(input, SHOPPING_SPEECH.whatToAdd);
    const name = itemName(spoken);
    return withList(input, async (items) => {
      const existing = sameOpenItem(items, name);
      if (existing) return answer(input, SHOPPING_SPEECH.alreadyThere(existing.name));
      await addItem(apiOf(input), input.requestEnvelope.request.requestId, name);
      logEvent("info", "shopping_item_added", { requestId: input.requestEnvelope.request.requestId });
      return answer(input, SHOPPING_SPEECH.added(name));
    });
  },
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
