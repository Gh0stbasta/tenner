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
