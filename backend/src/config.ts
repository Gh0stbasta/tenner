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
}

export interface OnboardingConfig {
  /** Cognito user pool that holds the household groups (COGNITO_USER_POOL_ID). */
  readonly userPoolId: string;
  /** Household that new users join (HOUSEHOLD_TENANT_ID), e.g. "default". */
  readonly tenantId: string;
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
  };
}

/** APPLICATION_TIMEZONE if it is a valid IANA zone, otherwise Europe/Berlin. */
function resolveTimeZone(value: string | undefined): string {
  return value !== undefined && isValidTimeZone(value) ? value : DEFAULT_TIMEZONE;
}
