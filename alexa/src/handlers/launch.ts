import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { apiOf, loadHousehold } from "../session.js";
import { fetchTenners, type TennerSummary } from "../tenners.js";
import { TennerApiError } from "../tennerApi.js";
import { SPEECH } from "../speech.js";
import { entitiesDirective } from "./members.js";
import { setDialogState } from "./state.js";

/**
 * „Alexa, öffne Tenner“: greets the recognized member; a recognized but unmapped voice is asked once
 * „Wer spricht gerade?“ (ALEXA-002). Without a linked account the error handler answers with the link prompt.
 */
export const LaunchRequestHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "LaunchRequest";
  },
  async handle(input: HandlerInput): Promise<Response> {
    const household = await loadHousehold(input);
    const names = household.context.members.map((member) => member.displayName);
    const builder = input.responseBuilder.addDirective(entitiesDirective(household.context.members, await titlesForEntities(input)));
    if (household.unknownSpeaker && names.length > 0) {
      setDialogState(input, "AWAIT_SPEAKER");
      return builder.speak(SPEECH.whoIsSpeaking(names)).reprompt(SPEECH.whoIsSpeakingReprompt(names)).getResponse();
    }
    const speech = household.speaker ? SPEECH.welcomeMember(household.speaker.displayName) : SPEECH.welcome;
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
