/**
 * Minimal structured logging for the skill Lambda (ALEXA-001). The Lambda log format is JSON; callers pass only
 * technical fields — never tokens, user/person IDs or spoken content. ALEXA-009 extends this.
 */

export type LogLevel = "info" | "error";

export function logEvent(level: LogLevel, event: string, fields: Readonly<Record<string, unknown>>): void {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}
