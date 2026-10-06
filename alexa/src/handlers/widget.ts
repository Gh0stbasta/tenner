import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response, interfaces } from "ask-sdk-model";
import { LaunchRequestHandler } from "./launch.js";

/** Tap on the Echo Show home-screen widget (ALEXA-007): open the skill on the dashboard, like a launch. */
export const OpenDashboardHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === "Alexa.Presentation.APL.UserEvent" && (input.requestEnvelope.request as interfaces.alexa.presentation.apl.UserEvent).arguments?.[0] === "openDashboard";
  },
  handle(input: HandlerInput): Promise<Response> | Response {
    return LaunchRequestHandler.handle(input);
  },
};
