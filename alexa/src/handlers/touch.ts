import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response, interfaces } from "ask-sdk-model";
import { loadHousehold } from "../session.js";
import { completeBy } from "./complete.js";
import { screenOf } from "./screen.js";

type UserEvent = interfaces.alexa.presentation.apl.UserEvent;

/**
 * „Erledigt“ by touch on the Echo Show (ALEXA-006): SendEvent ["complete", tennerId, title] from a TennerRow.
 * Same completion path as voice (ALEXA-004): speaker or asked member, request ID as idempotency key. The tap is an
 * explicit choice of a due Tenner, so no "not due yet" confirmation is needed.
 */
export const TouchCompleteHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    if (getRequestType(input.requestEnvelope) !== "Alexa.Presentation.APL.UserEvent") return false;
    const args = (input.requestEnvelope.request as UserEvent).arguments ?? [];
    return args[0] === "complete" && typeof args[1] === "string" && typeof args[2] === "string";
  },
  async handle(input: HandlerInput): Promise<Response> {
    const [, tennerId, title] = (input.requestEnvelope.request as UserEvent).arguments as [string, string, string];
    if (screenOf(input) === undefined) {
      // The session lost its screen state (e.g. a list opened by another session): refresh household-wide.
      input.attributesManager.setSessionAttributes({ ...input.attributesManager.getSessionAttributes(), screen: { assignedTo: null } });
    }
    return completeBy(input, await loadHousehold(input), { tennerId, title, warning: null });
  },
};
