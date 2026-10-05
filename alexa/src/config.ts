/**
 * Skill Lambda configuration (ALEXA-001). The only module that reads process.env.
 */

export interface SkillConfig {
  /** Base URL of the Tenner API stage (ALEXA-002). Empty: API calls fail as "unavailable". */
  readonly tennerApiBaseUrl: string;
  /** Alexa skill ID. When set, requests for any other skill are rejected (defense in depth to the Lambda permission). */
  readonly skillId: string | undefined;
  /** Timeout per Tenner API call; three sequential calls (context, list, write) must fit into the 7 s Lambda timeout. */
  readonly apiTimeoutMs: number;
}

export const DEFAULT_API_TIMEOUT_MS = 2000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SkillConfig {
  const skillId = env.ALEXA_SKILL_ID?.trim();
  return {
    tennerApiBaseUrl: (env.TENNER_API_BASE_URL ?? "").replace(/\/+$/, ""),
    skillId: skillId ? skillId : undefined,
    apiTimeoutMs: DEFAULT_API_TIMEOUT_MS,
  };
}
