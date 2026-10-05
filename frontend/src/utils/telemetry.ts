/** Frontend telemetry (FRONTEND-003): console logging until formal telemetry exists (OBSERVABILITY). */

export type TelemetryEvent =
  | "TennerCompleted"
  | "TennerArchived"
  | "TennerRestored"
  | "FilterChanged"
  | "TennerCreated"
  | "TennerUpdated"
  | "CompletionUndone"
  | "TennerSnoozed";

export function trackEvent(event: TelemetryEvent, properties: Readonly<Record<string, unknown>> = {}): void {
  console.info(`[telemetry] ${event}`, properties);
}
