/**
 * Runtime configuration. The only module that reads process.env; everything else receives
 * an AppConfig.
 */

import { DEFAULT_TIMEZONE, isValidTimeZone } from "./utils/timezone.js";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface TableConfig {
  readonly tenners: string;
  readonly history: string;
  /** Household settings, e.g. the timezone (SCHEDULING-008). */
  readonly households: string;
}

export interface AppConfig {
  readonly environment: string;
  readonly logLevel: LogLevel;
  readonly applicationName: string;
  /** Default household timezone (APPLICATION_TIMEZONE) until a household saves its own (SCHEDULING-008). */
  readonly timezone: string;
  /** DynamoDB table names. Undefined when TENNERS_TABLE, HISTORY_TABLE or HOUSEHOLDS_TABLE is missing. */
  readonly tables: TableConfig | undefined;
  /** Self-assignment to a household member (HOTFIX-001). Undefined when the variables are missing. */
  readonly onboarding: OnboardingConfig | undefined;
  /** Alexa APIs for the notifier (ALEXA-007/008); undefined while the skill's LWA credentials are not configured. */
  readonly alexaApi: AlexaApiConfig | undefined;
  /** EventBridge bus for household change events (HOUSEHOLD_EVENTS_BUS, ALEXA-007); undefined = no events. */
  readonly householdEventsBus: string | undefined;
  /** Web app URL for deep links in notifications (APP_URL, NOTIFICATION-003). */
  readonly appUrl: string | undefined;
  /** The household's tenant (HOUSEHOLD_TENANT_ID), e.g. "default"; the notifier runs for it. */
  readonly householdTenantId: string | undefined;
  /** Notification delivery log table (NOTIFICATIONS_TABLE, NOTIFICATION-001); undefined outside the notifier. */
  readonly notificationsTable: string | undefined;
  /** Cognito app client of the Alexa skill (ALEXA_CLIENT_ID); undefined while Alexa is not set up (ALEXA-002). */
  readonly alexaClientId: string | undefined;
}

export interface OnboardingConfig {
  /** Cognito user pool that holds the household groups (COGNITO_USER_POOL_ID). */
  readonly userPoolId: string;
  /** Household that new users join (HOUSEHOLD_TENANT_ID), e.g. "default". */
  readonly tenantId: string;
}

export interface AlexaApiConfig {
  /** Regional Alexa API endpoint, e.g. https://api.eu.amazonalexa.com (ALEXA_API_ENDPOINT). */
  readonly endpoint: string;
  /** SSM parameter names of the skill's LWA client (SECURITY-006); values are read at runtime. */
  readonly clientIdParameter: string;
  readonly clientSecretParameter: string;
  /** Skill stage for Proactive Events: "development" or "live" (ALEXA_SKILL_STAGE). */
  readonly skillStage: "development" | "live";
}

export const LOG_LEVELS: readonly LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];

const DEFAULTS = {
  environment: "prod",
  logLevel: "INFO",
  applicationName: "Tenner",
} as const;

function readTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Build the configuration from an environment map. Unknown log levels fall back to INFO. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const logLevel = (env.LOG_LEVEL ?? DEFAULTS.logLevel).toUpperCase();
  const tenners = readTrimmed(env.TENNERS_TABLE);
  const history = readTrimmed(env.HISTORY_TABLE);
  const households = readTrimmed(env.HOUSEHOLDS_TABLE);
  const userPoolId = readTrimmed(env.COGNITO_USER_POOL_ID);
  const householdTenantId = readTrimmed(env.HOUSEHOLD_TENANT_ID);
  return {
    environment: readTrimmed(env.ENVIRONMENT) ?? DEFAULTS.environment,
    logLevel: LOG_LEVELS.includes(logLevel as LogLevel) ? (logLevel as LogLevel) : DEFAULTS.logLevel,
    applicationName: readTrimmed(env.APPLICATION_NAME) ?? DEFAULTS.applicationName,
    timezone: resolveTimeZone(readTrimmed(env.APPLICATION_TIMEZONE)),
    tables: tenners && history && households ? { tenners, history, households } : undefined,
    onboarding: userPoolId && householdTenantId ? { userPoolId, tenantId: householdTenantId } : undefined,
    alexaClientId: readTrimmed(env.ALEXA_CLIENT_ID),
    notificationsTable: readTrimmed(env.NOTIFICATIONS_TABLE),
    householdTenantId,
    appUrl: readTrimmed(env.APP_URL),
    householdEventsBus: readTrimmed(env.HOUSEHOLD_EVENTS_BUS),
    alexaApi: alexaApiConfig(env),
  };
}

/** APPLICATION_TIMEZONE if it is a valid IANA zone, otherwise Europe/Berlin. */
function resolveTimeZone(value: string | undefined): string {
  return value !== undefined && isValidTimeZone(value) ? value : DEFAULT_TIMEZONE;
}

function alexaApiConfig(env: NodeJS.ProcessEnv): AlexaApiConfig | undefined {
  const endpoint = readTrimmed(env.ALEXA_API_ENDPOINT);
  const clientIdParameter = readTrimmed(env.ALEXA_LWA_CLIENT_ID_PARAMETER);
  const clientSecretParameter = readTrimmed(env.ALEXA_LWA_CLIENT_SECRET_PARAMETER);
  if (!endpoint || !clientIdParameter || !clientSecretParameter) return undefined;
  return { endpoint: endpoint.replace(/\/+$/, ""), clientIdParameter, clientSecretParameter, skillStage: env.ALEXA_SKILL_STAGE === "live" ? "live" : "development" };
}
