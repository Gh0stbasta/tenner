# MOBILE-002: Implement Service Worker and App Shell Caching

## Type

Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Load the app shell instantly and reliably, even on poor mobile connections.

---

# Background

After installation (MOBILE-001) users expect instant launch. Without a service worker,
every launch downloads `index.html` and assets over the network.

---

# Dependencies

```text
MOBILE-001
TICKET-018 (cache headers)
```

---

# Scope

## Caching Strategy

```text
App shell (index.html, hashed assets): precache, updated on new deploy
API requests: network only (offline data handled in MOBILE-003)
```

## Updates

- Detect new service worker; show "New version available — Reload" snackbar.
- Never silently serve a stale app shell for more than one launch.

## Safety

- Service worker scope `/`.
- Provide a kill switch: deploying a no-op service worker unregisters caching (documented).

---

# Testing Requirements

```text
Precache Manifest Generated
Update Notification
Kill Switch Procedure Documented
```

---

# Deliverables

```text
Service worker configuration
Update UI
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- App shell served from cache
- Updates detected and offered
- Kill switch documented

---

# Definition of Done

- App launches fast and updates predictably

---

# Out of Scope

- Offline data (MOBILE-003)

---

# Implementation Status

Implemented 2026-10-05.

- [x] App shell served from cache: `vite-plugin-pwa` (generateSW) precaches `index.html`, hashed assets, icons and
  manifest (9 entries); navigation fallback to `index.html`; API requests are not intercepted (network only).
  Verified in Chromium against the built app: the worker controls `/`, and with the network offline a deep link
  (`/tenners/abc`) still renders the app
- [x] Updates detected and offered: a rebuild changes the precache revisions; the running app showed
  "Neue Version verfügbar" and "Neu laden" switched to the new bundle; hourly update checks for open sessions
- [x] Kill switch documented (`SERVICE_WORKER_KILL_SWITCH` in `vite.config.ts` → `selfDestroying`, README)
- [x] Tests passing: frontend 334 (update prompt shown, reload, postpone, hourly check); precache manifest checked
  in the build output; lint and build clean
- [ ] Deploys through GitHub Actions: no infrastructure change; verified after merge

Decisions and assumptions:

- Dependency `vite-plugin-pwa` 2.0.0 (exact version, supports Vite 8): justified by the generated precache
  revisions; `npm audit` reports 0 vulnerabilities. It adds 287 build-time packages (Workbox build); the browser
  gets `workbox-window` only (5.7 kB, 2.2 kB gzip, separate chunk).
- Prompt mode (no automatic `skipWaiting`): a reload never happens under the user's hands; the waiting worker
  activates on "Neu laden" or on the next launch, so a stale shell lasts at most one launch.
- `sw.js` is a root file, so the existing deploy script uploads it with `no-cache`; no change to Terraform or the
  CSP (`default-src 'self'` covers the same-origin worker).
