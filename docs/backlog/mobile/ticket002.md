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
