/**
 * „Alexa, sag Butler Bruno Übersicht“ (MAINT-023): opens the Tafel (web app `/tafel`, MAINT-022) in the Echo Show's
 * browser with the APL command OpenURL. The only screen view of the skill (MAINT-006: no other views); it exists just to
 * start the browser and shows the address when the device does not allow it. Voice-only devices get a card.
 */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { SKILL_TITLE, esc } from "../speech.js";
import { isIntent } from "./intentRequest.js";

export const OVERVIEW_PATH = "/tafel";
export const OVERVIEW_TOKEN = "overview";

export const OVERVIEW_SPEECH = {
  opening: "Ich öffne die Übersicht.",
  noScreen: "Die Übersicht gibt es auf dem Echo Show im Browser. Ich habe dir den Link in die Alexa-App geschickt.",
  notConfigured: "Die Übersicht ist noch nicht eingerichtet.",
  manual: (url: string): string => `Öffne den Browser und geh auf ${url}`,
} as const;

/** APL document: a short text, and on mount OpenURL; a refused OpenURL replaces the text with the address. */
export function overviewDocument(url: string): Record<string, unknown> {
  return {
    type: "APL",
    version: "2023.2",
    theme: "dark",
    onMount: [
      {
        type: "OpenURL",
        source: url,
        onFail: [{ type: "SetValue", componentId: "overviewStatus", property: "text", value: OVERVIEW_SPEECH.manual(url) }],
      },
    ],
    mainTemplate: {
      items: [
        {
          type: "Container",
          width: "100vw",
          height: "100vh",
          justifyContent: "center",
          alignItems: "center",
          items: [
            { type: "Text", text: SKILL_TITLE, fontSize: "56dp", fontWeight: "bold" },
            { type: "Text", id: "overviewStatus", text: "Die Übersicht wird im Browser geöffnet …", fontSize: "36dp", paddingTop: "24dp", textAlign: "center" },
          ],
        },
      ],
    },
  };
}

const hasScreen = (input: HandlerInput): boolean =>
  input.requestEnvelope.context?.System?.device?.supportedInterfaces?.["Alexa.Presentation.APL"] !== undefined;

export function overviewIntentHandler(webAppUrl: string | undefined): RequestHandler {
  return {
    canHandle: (input) => isIntent(input, "OverviewIntent"),
    handle(input: HandlerInput): Response {
      const builder = input.responseBuilder;
      if (!webAppUrl) return builder.speak(OVERVIEW_SPEECH.notConfigured).withShouldEndSession(true).getResponse();
      const url = `${webAppUrl}${OVERVIEW_PATH}`;
      if (!hasScreen(input)) {
        return builder.speak(OVERVIEW_SPEECH.noScreen).withSimpleCard(SKILL_TITLE, OVERVIEW_SPEECH.manual(url)).withShouldEndSession(true).getResponse();
      }
      return builder
        .speak(esc(OVERVIEW_SPEECH.opening))
        .addDirective({ type: "Alexa.Presentation.APL.RenderDocument", token: OVERVIEW_TOKEN, document: overviewDocument(url), datasources: {} })
        .withShouldEndSession(true)
        .getResponse();
    },
  };
}
