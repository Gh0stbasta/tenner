# MOBILE-004: Implement Offline Completion Queue

## Type

Frontend Feature

---

## Priority

Low

---

## Phase

Long-Term

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
