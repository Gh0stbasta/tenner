/** ALEXA-005: „starte meinen Tag“ — daily briefing, also usable from a user's Alexa routine. */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { suggestionAnswer } from "../answers.js";
import { buildBriefing, type BriefingDashboard } from "../briefing.js";
import { fetchDashboard, type DashboardTenner } from "../dashboard.js";
import { logEvent } from "../log.js";
import { fetchMealDays, mealSentence } from "../meals.js";
import { TennerApiError } from "../tennerApi.js";
import { apiOf, loadHousehold } from "../session.js";
import { isIntent } from "./intentRequest.js";
import { answer } from "./respond.js";

const OFFER_ATTRIBUTE = "briefingSuggestion";
const SUGGESTED_ATTRIBUTE = "suggestedTennerId";
export const BRIEFING_GOODBYE = "Alles klar. Einen schönen Tag!";

function setOffer(input: HandlerInput, tenner: DashboardTenner | undefined, suggested?: string): void {
  const rest = Object.fromEntries(Object.entries(input.attributesManager.getSessionAttributes()).filter(([key]) => key !== OFFER_ATTRIBUTE));
  input.attributesManager.setSessionAttributes({
    ...rest,
    ...(tenner === undefined ? {} : { [OFFER_ATTRIBUTE]: tenner }),
    ...(suggested === undefined ? {} : { [SUGGESTED_ATTRIBUTE]: suggested }),
  });
}

/** FOOD-017: the meal sentence must never break the briefing; without a plan or on errors it is left out. */
async function mealsOrNothing(input: HandlerInput): Promise<string | undefined> {
  try {
    return mealSentence(await fetchMealDays(apiOf(input)));
  } catch (error) {
    logEvent("info", "briefing_meals_skipped", { requestId: input.requestEnvelope.request.requestId, kind: error instanceof TennerApiError ? error.kind : "UNKNOWN" });
    return undefined;
  }
}

const offerOf = (input: HandlerInput): DashboardTenner | undefined => input.attributesManager.getSessionAttributes()[OFFER_ATTRIBUTE] as DashboardTenner | undefined;

export const BriefingIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "BriefingIntent"),
  async handle(input: HandlerInput): Promise<Response> {
    const household = await loadHousehold(input);
    // One household-wide dashboard: personal parts are filtered from it, the household part uses its totals.
    const dashboard = (await fetchDashboard(apiOf(input), undefined)) as BriefingDashboard;
    const briefing = buildBriefing({
      dashboard,
      members: household.context.members,
      speaker: household.speaker,
      now: new Date(),
      timeZone: household.context.timezone,
      meals: await mealsOrNothing(input),
    });
    setOffer(input, briefing.suggestion);
    return briefing.suggestion ? answer(input, briefing.text, "Soll ich dir die erste Aufgabe nennen?") : answer(input, briefing.text);
  },
};

/** „ja“ after the briefing: name the first Tenner (it can then be completed with „erledigt“, ALEXA-004). */
export const BriefingYesHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AMAZON.YesIntent") && offerOf(input) !== undefined,
  handle(input: HandlerInput): Response {
    const tenner = offerOf(input);
    setOffer(input, undefined, tenner?.tennerId);
    return answer(input, suggestionAnswer(tenner));
  },
};

export const BriefingNoHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AMAZON.NoIntent") && offerOf(input) !== undefined,
  handle(input: HandlerInput): Response {
    setOffer(input, undefined);
    return answer(input, BRIEFING_GOODBYE);
  },
};
