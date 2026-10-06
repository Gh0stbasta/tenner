/**
 * Tenner Alexa skill Lambda entry point (ALEXA-001). Invoked by the Alexa Skills Kit trigger in eu-west-1.
 */
import type { RequestEnvelope, ResponseEnvelope } from "ask-sdk-model";
import { loadConfig } from "./config.js";
import { createSkill } from "./skill.js";

const skill = createSkill(loadConfig());

export async function handler(event: RequestEnvelope, context?: unknown): Promise<ResponseEnvelope> {
  return skill.invoke(event, context);
}
