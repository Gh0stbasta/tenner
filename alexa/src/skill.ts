import { SkillBuilders, type Skill } from "ask-sdk-core";
import type { SkillConfig } from "./config.js";
import { GenericErrorHandler } from "./handlers/error.js";
import { FallbackIntentHandler } from "./handlers/fallback.js";
import { HelpIntentHandler } from "./handlers/help.js";
import { LaunchRequestHandler } from "./handlers/launch.js";
import { SessionEndedRequestHandler } from "./handlers/sessionEnded.js";
import { StopIntentHandler } from "./handlers/stop.js";

/**
 * Builds the Tenner skill. Handler order matters: the first handler whose canHandle() is true wins, so the
 * catch-all FallbackIntentHandler comes last.
 */
export function createSkill(config: SkillConfig): Skill {
  const builder = SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      HelpIntentHandler,
      StopIntentHandler,
      SessionEndedRequestHandler,
      FallbackIntentHandler,
    )
    .addErrorHandlers(GenericErrorHandler)
    .withCustomUserAgent("tenner-alexa");
  if (config.skillId !== undefined) {
    builder.withSkillId(config.skillId);
  }
  return builder.create();
}
