/**
 * Central configuration (FRONTEND-001). The only module that reads import.meta.env (enforced by ESLint).
 * VITE_API_BASE_URL is set by deploy.yml from the Terraform output api_endpoint.
 */

export interface AppConfig {
  /** API stage URL without trailing slash, e.g. https://abc.execute-api.eu-central-1.amazonaws.com/prod. Empty if unset. */
  readonly apiBaseUrl: string;
}

export function readConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  return { apiBaseUrl: (env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "") };
}

export const config: AppConfig = readConfig(import.meta.env);
