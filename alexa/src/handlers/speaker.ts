import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { apiOf, loadHousehold, rememberHousehold, requireLink } from "../session.js";
import { SPEECH } from "../speech.js";
import { isIntent } from "./intentRequest.js";
import { memberFromSlot } from "./members.js";
import { setDialogState } from "./state.js";

/**
 * „Ich bin Julia“ / answer to „Wer spricht gerade?“ (ALEXA-002): maps the recognized voice (personId) to the named
 * member through the Tenner API. Without a recognized voice there is nothing to map.
 */
export const SpeakerIntentHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return isIntent(input, "SpeakerIntent");
  },
  async handle(input: HandlerInput): Promise<Response> {
    const link = requireLink(input);
    if (link.personId === undefined || link.personLinked) {
      setDialogState(input, undefined);
      return input.responseBuilder.speak(SPEECH.noVoiceProfile).reprompt(SPEECH.helpReprompt).getResponse();
    }
    const household = await loadHousehold(input);
    const names = household.context.members.map((member) => member.displayName);
    const member = memberFromSlot(input, "member", household.context.members);
    if (member === undefined) {
      setDialogState(input, "AWAIT_SPEAKER");
      return input.responseBuilder.speak(SPEECH.speakerNotUnderstood(names)).reprompt(SPEECH.whoIsSpeakingReprompt(names)).getResponse();
    }
    rememberHousehold(input, await apiOf(input).linkSpeaker(link.personId, member.userId));
    setDialogState(input, undefined);
    return input.responseBuilder.speak(SPEECH.speakerSaved(member.displayName)).reprompt(SPEECH.welcomeReprompt).getResponse();
  },
};
