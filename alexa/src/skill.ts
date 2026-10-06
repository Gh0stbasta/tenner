import { SkillBuilders, type Skill } from "ask-sdk-core";
import type { SkillConfig } from "./config.js";
import { ApiErrorHandler } from "./handlers/apiError.js";
import { BriefingIntentHandler, BriefingNoHandler, BriefingYesHandler } from "./handlers/briefing.js";
import { CompleteIntentHandler, CompletedByAnswerHandler, ConfirmNoHandler, ConfirmYesHandler, UndoIntentHandler } from "./handlers/complete.js";
import { GenericErrorHandler } from "./handlers/error.js";
import { FallbackIntentHandler } from "./handlers/fallback.js";
import { HelpIntentHandler } from "./handlers/help.js";
import { LaunchRequestHandler } from "./handlers/launch.js";
import { EnableRemindersIntentHandler, PermissionResponseHandler, messageReceivedHandler } from "./handlers/messaging.js";
import { NoIntentHandler, OverdueIntentHandler, SuggestIntentHandler, TodayIntentHandler, WorkLeftIntentHandler, YesIntentHandler } from "./handlers/questions.js";
import { SessionEndedRequestHandler } from "./handlers/sessionEnded.js";
import { SpeakerIntentHandler } from "./handlers/speaker.js";
import { StopIntentHandler } from "./handlers/stop.js";
import { TouchCompleteHandler } from "./handlers/touch.js";
import { OpenDashboardHandler } from "./handlers/widget.js";
import { linkInterceptor } from "./session.js";

/**
 * Builds the Tenner skill. Handler order matters: the first handler whose canHandle() is true wins, so the
 * catch-all FallbackIntentHandler comes last.
 */
export function createSkill(config: SkillConfig, fetchImpl: typeof fetch = globalThis.fetch): Skill {
  const builder = SkillBuilders.custom()
    .addRequestInterceptors(linkInterceptor(config, fetchImpl))
    .addRequestHandlers(
      LaunchRequestHandler,
      messageReceivedHandler(fetchImpl),
      PermissionResponseHandler,
      EnableRemindersIntentHandler,
      TouchCompleteHandler,
      OpenDashboardHandler,
      // Answers to open completion questions come before the general handlers of the same intents.
      CompletedByAnswerHandler,
      ConfirmYesHandler,
      ConfirmNoHandler,
      CompleteIntentHandler,
      UndoIntentHandler,
      SpeakerIntentHandler,
      BriefingIntentHandler,
      BriefingYesHandler,
      BriefingNoHandler,
      TodayIntentHandler,
      OverdueIntentHandler,
      SuggestIntentHandler,
      WorkLeftIntentHandler,
      YesIntentHandler,
      NoIntentHandler,
      HelpIntentHandler,
      StopIntentHandler,
      SessionEndedRequestHandler,
      FallbackIntentHandler,
    )
    .addErrorHandlers(ApiErrorHandler, GenericErrorHandler)
    .withCustomUserAgent("tenner-alexa");
  if (config.skillId !== undefined) {
    builder.withSkillId(config.skillId);
  }
  return builder.create();
}
