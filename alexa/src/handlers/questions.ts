/** ALEXA-003: today, overdue, suggestion and work left by voice; „ja“/„nein“ continue a listing. */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { continueListing, overdueAnswer, suggestion, suggestionAnswer, todayAnswer, workLeftAnswer, type Answer } from "../answers.js";
import { fetchDashboard, type Dashboard } from "../dashboard.js";
import { apiOf } from "../session.js";
import { SPEECH } from "../speech.js";
import { resolveAudience, type ResolvedAudience } from "./audience.js";
import { isIntent } from "./intentRequest.js";
import { CONTINUE_REPROMPT, answer, listingOf, setListing } from "./respond.js";

const SUGGESTION_ATTRIBUTE = "suggestedTennerId";

/** Load audience + dashboard; an unknown member name is answered directly. */
async function withDashboard(input: HandlerInput, build: (dashboard: Dashboard, resolved: ResolvedAudience) => Response): Promise<Response> {
  const resolved = await resolveAudience(input);
  if (resolved.unknownName !== undefined) return answer(input, SPEECH.unknownMember(resolved.unknownName, resolved.members.map((member) => member.displayName)));
  return build(await fetchDashboard(apiOf(input), resolved.assignedTo), resolved);
}

function answerListing(input: HandlerInput, result: Answer): Response {
  setListing(input, result.remaining);
  return result.remaining.length > 0 ? answer(input, result.text, CONTINUE_REPROMPT) : answer(input, result.text);
}

export const TodayIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "TodayIntent"),
  handle: (input) => withDashboard(input, (dashboard, { audience }) => answerListing(input, todayAnswer(dashboard, audience))),
};

export const OverdueIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "OverdueIntent"),
  handle: (input) => withDashboard(input, (dashboard, { audience }) => answerListing(input, overdueAnswer(dashboard, audience))),
};

export const SuggestIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "SuggestIntent"),
  handle: (input) =>
    withDashboard(input, (dashboard) => {
      const tenner = suggestion(dashboard);
      // ALEXA-004 can complete the suggested Tenner with „erledigt“.
      const session = input.attributesManager.getSessionAttributes();
      input.attributesManager.setSessionAttributes({ ...session, [SUGGESTION_ATTRIBUTE]: tenner?.tennerId });
      return answer(input, suggestionAnswer(tenner));
    }),
};

export const WorkLeftIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "WorkLeftIntent"),
  handle: (input) => withDashboard(input, (dashboard, { audience, members }) => answer(input, workLeftAnswer(dashboard, audience, members))),
};

/** „ja“ continues a listing; without one there is nothing to confirm. */
export const YesIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AMAZON.YesIntent") && listingOf(input).length > 0,
  handle(input: HandlerInput): Response {
    return answerListing(input, continueListing(listingOf(input)));
  },
};

/** „nein“ ends a listing. */
export const NoIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "AMAZON.NoIntent") && listingOf(input).length > 0,
  handle(input: HandlerInput): Response {
    setListing(input, []);
    return answer(input, "Alles klar.");
  },
};

export function suggestedTennerId(input: HandlerInput): string | undefined {
  const id = input.attributesManager.getSessionAttributes()[SUGGESTION_ATTRIBUTE] as unknown;
  return typeof id === "string" ? id : undefined;
}
