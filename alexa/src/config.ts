/**
 * Skill Lambda configuration (ALEXA-001). The only module that reads process.env.
 */

export interface SkillConfig {
  /** Base URL of the Tenner API stage (used from ALEXA-002 on). Empty in unit tests. */
  readonly tennerApiBaseUrl: string;
  /** Alexa skill ID. When set, requests for any other skill are rejected (defense in depth to the Lambda permission). */
  readonly skillId: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SkillConfig {
  const skillId = env.ALEXA_SKILL_ID?.trim();
  return {
    tennerApiBaseUrl: (env.TENNER_API_BASE_URL ?? "").replace(/\/+$/, ""),
    skillId: skillId ? skillId : undefined,
  };
}
