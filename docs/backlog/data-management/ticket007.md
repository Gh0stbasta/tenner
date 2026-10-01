# DATA-007: Implement Completion Correction

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

Allow correcting mistakes in recorded completions (wrong person, wrong duration,
wrong time) without violating history immutability.

---

# Background

TICKET-013/014 exclude editing and deleting history. Undo only reverts the most recent
completion of a Tenner (TICKET-014). Older mistakes currently distort analytics forever.

---

# Dependencies

```text
TICKET-014
TICKET-020
```

---

# Scope

## Model: Compensating Events

History stays append-only. A correction adds an event:

```text
eventType       CORRECTION
correctsId      completionId being corrected
changes         { completedBy?, actualMinutes?, completedAt?, voided? }
recordedBy      acting user
recordedAt
```

Readers (history API, analytics) apply corrections when projecting the effective history.
`voided: true` removes a completion from effective history (e.g. duplicate entry).

## Rules

```text
Corrections only within 30 days of completion
completedAt corrections must not change the Tenner's nextDue (unless it is the latest completion — then recalculate)
A correction can be corrected again (latest wins)
```

## API

```text
POST /history/{completionId}/corrections
```

## Frontend

"Correct" action on history entries (detail page, history page).

---

# Testing Requirements

```text
Correct User
Correct Minutes
Correct Time Of Latest Completion Recalculates nextDue
Void Completion
Correction Window Enforced
Analytics Use Effective History
Original Record Unchanged
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Correction endpoint
Effective-history projection
UI action
Tests
docs/architecture.md (history correction model)
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

- Mistakes can be corrected
- Original records remain unchanged
- Analytics reflect corrections
- Tests passing

---

# Definition of Done

- History is accurate and auditable
- Feature deploys through GitHub Actions

---

# Out of Scope

- Bulk corrections
