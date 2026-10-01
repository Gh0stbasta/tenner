/** Runtime configuration read from Lambda environment variables. */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface TableConfig {
  readonly tenners: string;
  readonly history: string;
}

export interface AppConfig {
  readonly environment: string;
  readonly logLevel: LogLevel;
  readonly applicationName: string;
  /** DynamoDB table names. Undefined when TENNERS_TABLE or HISTORY_TABLE is missing. */
  readonly tables: TableConfig | undefined;
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
  return {
    environment: readTrimmed(env.ENVIRONMENT) ?? DEFAULTS.environment,
    logLevel: LOG_LEVELS.includes(logLevel as LogLevel) ? (logLevel as LogLevel) : DEFAULTS.logLevel,
    applicationName: readTrimmed(env.APPLICATION_NAME) ?? DEFAULTS.applicationName,
    tables: tenners && history ? { tenners, history } : undefined,
  };
}
