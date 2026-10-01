/**
 * Structured JSON logger with level filtering and request correlation.
 * Never pass credentials, tokens or request payloads as fields.
 */

import { LOG_LEVELS, type LogLevel } from "../config.js";

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Logger that adds the given fields (e.g. correlationId) to every entry. */
  child(fields: LogFields): Logger;
}

const WRITERS: Record<LogLevel, (line: string) => void> = {
  DEBUG: (line) => console.debug(line),
  INFO: (line) => console.info(line),
  WARN: (line) => console.warn(line),
  ERROR: (line) => console.error(line),
};

export function createLogger(minLevel: LogLevel, context: LogFields = {}): Logger {
  const threshold = LOG_LEVELS.indexOf(minLevel);
  const write = (level: LogLevel, message: string, fields: LogFields = {}): void => {
    if (LOG_LEVELS.indexOf(level) < threshold) return;
    WRITERS[level](JSON.stringify({ level, message, ...context, ...fields }));
  };
  return {
    debug: (message, fields) => write("DEBUG", message, fields),
    info: (message, fields) => write("INFO", message, fields),
    warn: (message, fields) => write("WARN", message, fields),
    error: (message, fields) => write("ERROR", message, fields),
    child: (fields) => createLogger(minLevel, { ...context, ...fields }),
  };
}

/** Serialize an error for logs: name, message and code (no stack, no payloads). */
export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { errorName: error.name, errorMessage: error.message, ...(typeof code === "string" ? { errorCode: code } : {}) };
  }
  return { errorMessage: String(error) };
}
