import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

/**
 * Kill switch (MOBILE-002): set to true and deploy to replace the service worker with one that unregisters itself and
 * deletes its caches (see README → "Service Worker").
 */
const SERVICE_WORKER_KILL_SWITCH = false;

export default defineConfig({
  // MOBILE-003: a new build discards the persisted offline cache (data shapes may have changed).
  define: { __APP_BUILD__: JSON.stringify(process.env.GITHUB_SHA ?? String(Date.now())) },
  plugins: [
    react(),
    // MOBILE-002: precaches the app shell (index.html and the hashed assets) with revisions, so every deploy installs
    // a new service worker that the app offers as "Neue Version verfügbar".
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // The manifest is the static public/manifest.json (MOBILE-001).
      manifest: false,
      selfDestroying: SERVICE_WORKER_KILL_SWITCH,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        // Client-side routes (/settings, /tenners/…) are answered with the cached index.html.
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // No runtimeCaching: API requests (other origin) always go to the network; offline data comes from the
        // persisted query cache (MOBILE-003).
      },
    }),
  ],
  build: {
    // Content-hashed files in assets/ are cached immutably by scripts/deploy-frontend.sh.
    assetsDir: "assets",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    env: { VITE_API_BASE_URL: "https://api.test/prod" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/tests/**", "src/**/*.test.{ts,tsx}", "src/vite-env.d.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
