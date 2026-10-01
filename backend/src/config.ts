/** Runtime configuration read from Lambda environment variables. */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface AppConfig {
  readonly environment: string;
  readonly logLevel: LogLevel;
  readonly applicationName: string;
}

const LOG_LEVELS: readonly LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];

const DEFAULTS = {
  environment: "prod",
  logLevel: "INFO",
  applicationName: "Tenner",
} as const;

/** Build the configuration from an environment map. Unknown log levels fall back to INFO. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const logLevel = (env.LOG_LEVEL ?? DEFAULTS.logLevel).toUpperCase();
  return {
    environment: env.ENVIRONMENT?.trim() || DEFAULTS.environment,
    logLevel: LOG_LEVELS.includes(logLevel as LogLevel) ? (logLevel as LogLevel) : DEFAULTS.logLevel,
    applicationName: env.APPLICATION_NAME?.trim() || DEFAULTS.applicationName,
  };
}
