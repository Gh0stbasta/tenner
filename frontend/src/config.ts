/**
 * Central configuration (FRONTEND-001, SECURITY-003). The only module that reads import.meta.env
 * (enforced by ESLint). deploy.yml sets the variables from Terraform outputs.
 */

export interface AuthConfig {
  /** OIDC issuer of the Cognito user pool, e.g. https://cognito-idp.eu-central-1.amazonaws.com/<pool-id>. */
  readonly issuerUrl: string;
  /** Public app client ID. */
  readonly clientId: string;
  /** Managed login domain, e.g. https://tenner-prod-xxxx.auth.eu-central-1.amazoncognito.com (logout endpoint). */
  readonly loginUrl: string;
}

export interface AppConfig {
  /** API stage URL without trailing slash, e.g. https://abc.execute-api.eu-central-1.amazonaws.com/prod. Empty if unset. */
  readonly apiBaseUrl: string;
  /** Cognito settings; undefined if any value is missing (login cannot work then). */
  readonly auth: AuthConfig | undefined;
}

const trimUrl = (value: string | undefined): string => (value ?? "").trim().replace(/\/+$/, "");

export function readConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const issuerUrl = trimUrl(env.VITE_COGNITO_ISSUER_URL);
  const clientId = (env.VITE_COGNITO_CLIENT_ID ?? "").trim();
  const loginUrl = trimUrl(env.VITE_COGNITO_LOGIN_URL);
  return {
    apiBaseUrl: trimUrl(env.VITE_API_BASE_URL),
    auth: issuerUrl && clientId && loginUrl ? { issuerUrl, clientId, loginUrl } : undefined,
  };
}

export const config: AppConfig = readConfig(import.meta.env);
