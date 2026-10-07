/**
 * Skill Lambda configuration (ALEXA-001). The only module that reads process.env.
 */

export interface SkillConfig {
  /** Base URL of the Tenner API stage (ALEXA-002). Empty: API calls fail as "unavailable". */
  readonly tennerApiBaseUrl: string;
  /** Alexa skill ID. When set, requests for any other skill are rejected (defense in depth to the Lambda permission). */
  readonly skillId: string | undefined;
  /** Longest single Tenner API attempt; every call is also limited by the request's time budget (MAINT-001). */
  readonly apiTimeoutMs: number;
  /** Time budget per skill request for all API calls together; default RESPONSE_BUDGET_MS. */
  readonly responseBudgetMs?: number;
}

/** One attempt may take this long: enough for a cold start (MAINT-001), short enough to leave time for a retry. */
export const DEFAULT_API_TIMEOUT_MS = 4000;
/** All API calls of one request: below the 7 s Lambda timeout and Alexa's 8 s, with room for init and the answer. */
export const RESPONSE_BUDGET_MS = 6500;
/** A read is retried only if at least this much budget is left. */
export const MIN_RETRY_MS = 1000;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SkillConfig {
  const skillId = env.ALEXA_SKILL_ID?.trim();
  return {
    tennerApiBaseUrl: (env.TENNER_API_BASE_URL ?? "").replace(/\/+$/, ""),
    skillId: skillId ? skillId : undefined,
    apiTimeoutMs: DEFAULT_API_TIMEOUT_MS,
  };
}
