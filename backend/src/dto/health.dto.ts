export type DatabaseStatus = "connected" | "unreachable" | "misconfigured";

/** GET /health response (operational endpoint, not wrapped in the success envelope). */
export interface HealthResponse {
  readonly status: "ok" | "error";
  readonly application: string;
  readonly environment: string;
  readonly database: DatabaseStatus;
}
