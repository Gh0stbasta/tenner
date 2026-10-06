# MOBILE-004: Implement Offline Completion Queue

## Type

Frontend Feature

---

## Priority

Low

---

## Phase

V2 (moved from Long-Term by the owner on 2026-10-06, BACKLOG-001)

---

## Goal

Allow completing Tenners while offline; completions are synced when the connection returns.

---

# Background

The Complete endpoint supports `Idempotency-Key` (TICKET-013) and an optional
`completedAt` timestamp, which makes safe offline replay possible.

---

# Dependencies

```text
MOBILE-003
TICKET-013
```

---

# Scope

## Queue

- Offline completions stored in IndexedDB with: tennerId, completedAt (device time, UTC),
  completedBy, actualMinutes, idempotencyKey (UUID generated at action time).
- Optimistic UI update with "pending sync" badge.

## Sync

- On reconnect (or Background Sync API where supported), replay in order.
- `409 CONCURRENT_MODIFICATION`: reload Tenner, retry once; if the Tenner was already
  completed later by someone else, keep the completion (history) and show a notice.
- `409 TENNER_INACTIVE` / `404`: drop with visible notification.
- Future-timestamp rejection: clamp clock skew ≤ 5 min; otherwise show error.

## Scope Limits

Only completion is supported offline. Create/edit/delete require connectivity.

---

# Testing Requirements

```text
Queue Offline Completion
Replay On Reconnect
Idempotent Replay
Conflict Handling
Dropped Item Notification
Clock Skew Handling
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Offline queue
Sync logic
UI indicators
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

- Completions possible offline
- Sync is idempotent
- Conflicts handled visibly
- Tests passing

---

# Definition of Done

- Connectivity no longer blocks recording completions

---

# Out of Scope

- Offline create/edit
- Multi-device conflict resolution beyond documented rules

---

# Implementation Status

Implemented 2026-10-06.

- [x] Completions possible offline: queue in `localStorage` with tennerId, title, completedBy, completedAt (device
  time, UTC) and an Idempotency-Key from the action time; optimistic removal from the dashboard (also after a
  refetch, until synced); „⏳ … wartet auf die Übertragung“ indicator; undo takes it out of the queue
- [x] Sync is idempotent: replay in order on start, `online` and every 60 s with the stored key and `completedAt`
- [x] Conflicts handled visibly: concurrent modification retried once; deleted/archived, already completed later,
  future time beyond 5 min and other refusals dropped with a message in one snackbar; transient errors keep
  the entry
- [x] Tests passing: frontend 385 (queue, sync rules, clock skew, offline → online flow, dropped connection, restart,
  duplicate, undo, logout confirmation); `src/features/offline/` 100 % covered; lint, typecheck, build clean
- [ ] Verified on a phone in flight mode — manual after deploy (owner)

Decisions and assumptions:

- `localStorage` instead of IndexedDB, as in MOBILE-003 (a handful of entries; no extra library).
- No Background Sync API: the app replays when it is open (start, `online`, interval). Background Sync is
  Chromium-only and would need custom service-worker code (MOBILE-002 uses a generated worker).
- „Completed later by someone else“ (TD-038): the backend rejects a `completedAt` before the last completion, so the
  offline completion is dropped with a notice instead of being kept in the history (ticket scope differs; changing
  the backend's history rules is out of scope).
- `actualMinutes` is not queued: the UI does not ask for it (server default = estimate, ANALYTICS-005).
- Also queued: an online request without any response (status 0); a replay with the same key returns the original
  completion if the first request had reached the server.
- Logout with waiting entries asks for confirmation, then deletes the queue (privacy, MOBILE-003).

