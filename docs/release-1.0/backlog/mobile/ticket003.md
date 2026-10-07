# MOBILE-003: Implement Offline Read Support

## Type

Frontend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Show the last known dashboard and Tenner list when the device is offline
(e.g. in the basement or garden).

---

# Background

Many Tenners are done in places with poor connectivity. Seeing what is due should
not require a connection.

---

# Dependencies

```text
MOBILE-002
UX-005
```

---

# Scope

- Persist the TanStack Query cache for dashboard, Tenner list and detail queries
  using `@tanstack/query-persist-client` with IndexedDB.
- Max age: 7 days; cleared on logout.
- Offline indicator shows "Showing data from <time>".
- Personal data in IndexedDB is limited to what the UI shows; document the privacy implication.

---

# Testing Requirements

```text
Cache Persisted
Cache Restored Offline
Stale Indicator
Cleared On Logout
Max Age Respected
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Query persistence
Offline indicators
Tests
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

- Dashboard and lists available offline
- Data age visible
- Cache cleared on logout
- Tests passing

---

# Definition of Done

- Users can see their Tenners without connectivity

---

# Out of Scope

- Offline mutations (MOBILE-004)

---

# Implementation Status

Implemented 2026-10-06.

- [x] Dashboard and lists available offline: `PersistQueryClientProvider` (mounted by the AuthGate per member)
  persists dashboard, Tenner list and detail, history, members and categories; tested offline restore without a
  request
- [x] Data age visible: the connectivity banner adds „Angezeigt wird der Stand von …“ while offline or unreachable
- [x] Cache cleared on logout (`clearOfflineCache`); discarded after 7 days, on a new build and for another member
- [x] Tests passing: frontend 369 (persister, restore offline, user and max-age busting, logout, offline AuthGate,
  banner); coverage of `src/features/offline/` 100 %; lint, typecheck and build clean
- [ ] Verified on a phone in flight mode — manual after deploy (owner)

Decisions and assumptions:

- `localStorage` instead of IndexedDB (ticket scope): a few hundred kB for one household, no extra library
  (`idb-keyval`), synchronous and testable; documented in `frontend/README.md`.
- Dependency `@tanstack/react-query-persist-client` 5.104.0 (exact, same release as `@tanstack/react-query`;
  `npm audit` 0 vulnerabilities).
- Offline session: a stored login opens the app offline even with an expired token; otherwise the AuthGate would
  redirect to the login, which cannot work offline. The data shown is the device's own cache. Back online, an
  expired session first tries a silent renewal (refresh token) before the login redirect.
- Default `gcTime` raised to 7 days so pages not visited in the current session stay in the persisted cache.
- Privacy implication documented in `frontend/README.md` and `docs/security.md` (residual risks).

