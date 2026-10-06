/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_COGNITO_ISSUER_URL?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_LOGIN_URL?: string;
}

/** Build id injected by vite.config.ts (MOBILE-003: a new build discards the offline cache). */
declare const __APP_BUILD__: string;
