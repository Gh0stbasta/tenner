# SCHEDULING-004: Implement Skip Occurrence

## Type

Backend + Frontend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow users to skip a single occurrence of a Tenner so that it moves to its next cycle
without being recorded as completed.

Example:

```text
"Mow lawn" due during a dry week where the lawn didn't grow → skip.
```

---

# Background

Snooze (SCHEDULING-003) moves the due date by a short time. Skip intentionally
drops the current occurrence and schedules the next one.

---

# Dependencies

```text
SCHEDULING-001
SCHEDULING-003
```

---

# Scope

## Endpoint

```text
POST /tenners/{tennerId}/skip
```

Optional body:

```json
{ "reason": "Not needed this week" }
```

`reason`: optional, max 200 characters.

## Rules

```text
nextDue = calculateNextDue(today, unit, interval)
lastCompleted unchanged
event recorded with eventType = SKIP
analytics: skipped occurrences count neither as fulfilled nor as neglected
```

ANALYTICS-006 and ANALYTICS-008 must be updated to exclude skipped cycles from
expected completions.

## Frontend

"Skip this time" action in the Tenner action menu with optional reason.

---

# Testing Requirements

```text
Skip Advances Due Date
Last Completed Unchanged
Event Recorded
Analytics Exclusion
Reason Length Validation
Inactive Tenner Rejected
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Skip endpoint
Analytics adjustments
Frontend action
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

- Occurrences can be skipped
- Skip does not count as completion
- Analytics treat skips correctly
- Tests passing

---

# Definition of Done

- Irrelevant occurrences can be dropped honestly
- Feature deploys through GitHub Actions

---

# Out of Scope

- Undo skip (may follow if needed)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Occurrences can be skipped: `POST /tenners/{tennerId}/skip` with optional reason (≤ 200 characters);
  "Diesmal überspringen …" in the "Verschieben" menu (dashboard due/overdue items, detail header) with a reason dialog
- [x] Skip does not count as completion: `lastCompleted` unchanged; `SKIP` event in `tenner-history` without
  `completedAt`, so history, undo and the consistency indicator never see it
- [x] Analytics treat skips correctly: current analytics are completion-based and ignore skips; ANALYTICS-006 and
  ANALYTICS-008 now require excluding skipped cycles from expected completions (both are not implemented yet)
- [x] Tests passing: backend 544 (advances due date, last completed unchanged, event recorded, reason length,
  inactive/archived rejected, concurrent modification, not-due-yet base), frontend 263 (dialog, reason, limit,
  error), Terraform 51 (new route); lint, build, `terraform fmt`/`validate` clean
- [ ] Deploys through GitHub Actions: new API route only (no new IAM permissions); verified after merge

Decisions and assumptions:

- Base date: `max(today, nextDue)` instead of always today, so skipping a Tenner that is not due yet moves it past
  its upcoming occurrence instead of possibly earlier. For due and overdue Tenners this equals the ticket's rule.
- Skip also clears an active snooze (the occurrence is dropped).
- The skip action is offered where snooze is (due and overdue Tenners).
- The reason is stored but never logged (free text may contain personal information).
- No undo for skips (out of scope); recorded in TD-028.
