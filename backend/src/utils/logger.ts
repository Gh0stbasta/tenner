/**
 * Minimal structured JSON logger with level filtering.
 * Never pass credentials, tokens or request payloads as fields.
 */

import { LOG_LEVELS, type LogLevel } from "../config.js";

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const WRITERS: Record<LogLevel, (line: string) => void> = {
  DEBUG: (line) => console.debug(line),
  INFO: (line) => console.info(line),
  WARN: (line) => console.warn(line),
  ERROR: (line) => console.error(line),
};

export function createLogger(minLevel: LogLevel): Logger {
  const threshold = LOG_LEVELS.indexOf(minLevel);
  const write = (level: LogLevel, message: string, fields: LogFields = {}): void => {
    if (LOG_LEVELS.indexOf(level) < threshold) return;
    WRITERS[level](JSON.stringify({ level, message, ...fields }));
  };
  return {
    debug: (message, fields) => write("DEBUG", message, fields),
    info: (message, fields) => write("INFO", message, fields),
    warn: (message, fields) => write("WARN", message, fields),
    error: (message, fields) => write("ERROR", message, fields),
  };
}
