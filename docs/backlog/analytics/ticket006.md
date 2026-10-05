# ANALYTICS-006: Implement Neglected Tenners Analysis

## Type

Backend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Identify Tenners that are chronically neglected, not just currently overdue.

Users must be able to answer:

```text
What hasn't been done for months?
What do we keep postponing?
```

---

# Background

The architecture lists "Most Neglected Tenners" and "Longest Overdue Tenners".

The dashboard (TICKET-016) shows what is overdue **now**, but not patterns over time.

---

# Dependencies

```text
ANALYTICS-001
```

---

# Scope

Implement:

```text
GET /analytics/neglected
```

## Query Parameters

```text
limit   1 - 50, default 10
period  as ANALYTICS-001, default last90
```

---

# Metrics Per Tenner

```text
daysOverdue          max(0, today - nextDue)
daysSinceCompleted   today - lastCompleted (null if never)
expectedCompletions  floor(periodDays / frequencyDays)
actualCompletions    completions in period
fulfillmentRatio     actualCompletions / expectedCompletions (capped at 1)
neglectScore         see below
```

## Neglect Score

```text
neglectScore = (1 - fulfillmentRatio) × 0.6
             + min(daysOverdue / frequencyDays, 1) × 0.4
```

Tenners created within the period use their creation date as period start.

Never-completed Tenners older than one frequency interval are considered fully neglected.

The formula must be centralized and documented in `docs/analytics.md`.

---

# Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tennerId": "tenner-012",
        "title": "Clean Exterior Window Sills",
        "assignedTo": "JULIA",
        "category": "HOME",
        "daysOverdue": 21,
        "daysSinceCompleted": 49,
        "fulfillmentRatio": 0.33,
        "neglectScore": 0.68
      }
    ]
  }
}
```

Sorted by `neglectScore` descending.

---

## Paused Periods (added by SCHEDULING-005)

Exclude paused periods from expected completions: individual pauses (`pausedAt` … `pausedUntil` on the Tenner;
only the current pause is stored) and the household vacation (`tenner-households.vacation`, per category).

## Skipped and Snoozed Occurrences (added by SCHEDULING-004)

Skipped occurrences (`tenner-history` items with `eventType = SKIP`, `historyId` prefix `skip#`) count neither
as fulfilled nor as neglected: exclude each skipped cycle from the expected completions. Snoozes
(`eventType = SNOOZE`) move the due date but are not completions either. Neither event type appears in the
`completedAt` GSIs; read them with a base-table query on the `historyId` prefix (TD-028).

---

# Testing Requirements

```text
Fulfillment Ratio
Neglect Score
Never Completed Tenner
Recently Created Tenner
Ratio Cap
Sorting
Inactive Tenners Excluded
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/neglected
Tests
docs/analytics.md update
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

- Neglected Tenners endpoint implemented
- Neglect score calculated as documented
- Edge cases (never completed, new Tenners) handled
- Results sorted and limited
- Tests passing

---

# Definition of Done

- Chronically neglected responsibilities are discoverable
- Feature deploys through GitHub Actions

---

# Out of Scope

- Notifications about neglect (NOTIFICATION-004)
- AI explanations (AI-004)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Neglected Tenners endpoint: `GET /analytics/neglected` (route in Terraform), `limit` 1–50 (default 10), period
  default `last90`
- [x] Neglect score `(1 − fulfillment) × 0.6 + min(daysOverdue ÷ frequencyDays, 1) × 0.4`, centralized in
  `backend/src/analytics/neglect.ts` and documented in `docs/analytics.md`
- [x] Edge cases: never completed Tenners older than one interval are fully neglected (score 1); Tenners created in
  the period start counting at creation; nothing expected yet → ratio 1
- [x] Sorted by score (ties: days overdue, title) and limited
- [x] Paused periods (vacation per category, current individual pause) and skipped occurrences excluded from the
  expected completions; skips are read from the base table (`listSkips`, `skip#` prefix)
- [x] Tests passing: backend 727; lint and build clean
- [ ] Deploys through GitHub Actions: one new API route; verified after merge

Decisions and assumptions:

- Tenners with a score of 0 are left out, so the list only shows real neglect (empty when all is well).
- Paused Tenners are not overdue (`daysOverdue = 0`), and a paused never-completed Tenner is not "abandoned".
- Only the current individual pause is known; earlier pauses still count as expected days (TD-029).
