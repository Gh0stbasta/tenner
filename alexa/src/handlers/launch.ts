import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { apiOf, loadHousehold } from "../session.js";
import { fetchTenners, type TennerSummary } from "../tenners.js";
import { TennerApiError } from "../tennerApi.js";
import { SPEECH } from "../speech.js";
import { entitiesDirective } from "./members.js";
import { fetchDashboard } from "../dashboard.js";
import { hasScreen, renderDashboard } from "./screen.js";
import { setDialogState } from "./state.js";

/**
 * „Alexa, öffne Tenner Board“: greets the recognized member; a recognized but unmapped voice is asked once
 * „Wer spricht gerade?“ (ALEXA-002). Without a linked account the error handler answers with the link prompt.
 */
export const LaunchRequestHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "LaunchRequest";
  },
  async handle(input: HandlerInput): Promise<Response> {
    const household = await loadHousehold(input);
    await registerForWidget(input, household.context.alexaUserKnown);
    const names = household.context.members.map((member) => member.displayName);
    const builder = input.responseBuilder.addDirective(entitiesDirective(household.context.members, await titlesForEntities(input)));
    if (household.unknownSpeaker && names.length > 0) {
      setDialogState(input, "AWAIT_SPEAKER");
      return builder.speak(SPEECH.whoIsSpeaking(names)).reprompt(SPEECH.whoIsSpeakingReprompt(names)).getResponse();
    }
    const speech = household.speaker ? SPEECH.welcomeMember(household.speaker.displayName) : SPEECH.welcome;
    if (hasScreen(input)) {
      // ALEXA-006: the household's day on screen; no open microphone so the dashboard stays visible.
      renderDashboard(input, await fetchDashboard(apiOf(input), undefined), household.context.members, undefined);
      return builder.speak(speech).getResponse();
    }
    return builder.speak(speech).reprompt(SPEECH.welcomeReprompt).getResponse();
  },
};

/** Tenner titles for voice completion (ALEXA-004); a failure only costs recognition quality, not the greeting. */
async function titlesForEntities(input: HandlerInput): Promise<readonly TennerSummary[]> {
  try {
    return await fetchTenners(apiOf(input));
  } catch (error) {
    if (!(error instanceof TennerApiError)) throw error;
    logEvent("info", "entities_skipped", { requestId: input.requestEnvelope.request.requestId, kind: error.kind });
    return [];
  }
}

/**
 * ALEXA-007: the first launch of an Alexa account registers it as Echo Show widget target. A failure only delays the
 * widget (retried on the next launch); the Amazon user ID is never logged.
 */
async function registerForWidget(input: HandlerInput, known: boolean | undefined): Promise<void> {
  const alexaUserId = input.requestEnvelope.context?.System?.user?.userId;
  if (known !== false || alexaUserId === undefined) return;
  try {
    await apiOf(input).registerAlexaUser(alexaUserId);
  } catch (error) {
    if (!(error instanceof TennerApiError)) throw error;
    logEvent("info", "widget_registration_skipped", { requestId: input.requestEnvelope.request.requestId, kind: error.kind });
  }
}
