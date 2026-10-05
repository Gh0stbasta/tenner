import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { loadHousehold } from "../session.js";
import { SPEECH } from "../speech.js";
import { memberEntitiesDirective } from "./members.js";
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
    const builder = input.responseBuilder.addDirective(memberEntitiesDirective(household.context.members));
    if (household.unknownSpeaker && names.length > 0) {
      setDialogState(input, "AWAIT_SPEAKER");
      return builder.speak(SPEECH.whoIsSpeaking(names)).reprompt(SPEECH.whoIsSpeakingReprompt(names)).getResponse();
    }
    const speech = household.speaker ? SPEECH.welcomeMember(household.speaker.displayName) : SPEECH.welcome;
    return builder.speak(speech).reprompt(SPEECH.welcomeReprompt).getResponse();
  },
};
