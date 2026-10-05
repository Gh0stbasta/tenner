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
