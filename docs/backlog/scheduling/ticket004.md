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
