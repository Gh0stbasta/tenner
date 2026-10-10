/**
 * „Alexa, frag Familien Zentrale, was es heute gibt“ (FOOD-017): today's or tomorrow's lunch and dinner, optionally only one
 * meal („was essen wir heute abend“). API errors go to the error handler (friendly fallback speech).
 */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { IntentRequest, Response } from "ask-sdk-model";
import { dayIndex, fetchMealDays, mealAnswer, type MealSlot } from "../meals.js";
import { apiOf } from "../session.js";
import { isIntent } from "./intentRequest.js";
import { answer } from "./respond.js";

export const MEAL_SPEECH = {
  onlyTwoDays: "Ich kenne nur das Essen für heute und morgen. Den ganzen Plan siehst du in der App.",
} as const;

function slotOf(input: HandlerInput, name: string): { value?: string; id?: string } {
  const slot = (input.requestEnvelope.request as IntentRequest).intent.slots?.[name];
  const resolved = slot?.resolutions?.resolutionsPerAuthority?.find((authority) => authority.status.code === "ER_SUCCESS_MATCH")?.values?.[0]?.value;
  return { ...(slot?.value ? { value: slot.value } : {}), ...(resolved?.id ? { id: resolved.id } : {}) };
}

export const MealTodayIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "MealTodayIntent"),
  async handle(input: HandlerInput): Promise<Response> {
    const days = await fetchMealDays(apiOf(input));
    const index = dayIndex(slotOf(input, "day").value, days.today);
    if (index === undefined) return answer(input, MEAL_SPEECH.onlyTwoDays);
    const mealId = slotOf(input, "meal").id;
    const slot: MealSlot | undefined = mealId === "LUNCH" || mealId === "DINNER" ? mealId : undefined;
    return answer(input, mealAnswer(days.days[index], index === 0 ? "heute" : "morgen", slot));
  },
};
