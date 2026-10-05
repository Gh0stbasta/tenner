# ANALYTICS-008: Implement Habit & Consistency Analytics

## Type

Backend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Measure consistency per Tenner over time, in line with the principle
"Consistency Over Intensity".

Users must be able to answer:

```text
How consistent am I over time?
Which habits are stable, which are slipping?
```

---

# Background

Streak calculations were explicitly excluded from the completion workflow (TICKET-013).

For recurring Tenners a classic "daily streak" is not meaningful. Consistency must
be measured relative to each Tenner's own frequency.

---

# Dependencies

```text
ANALYTICS-001
ANALYTICS-006
```

---

# Scope

Implement:

```text
GET /analytics/habits
GET /analytics/habits/{tennerId}
```

---

# Metrics

## Interval Streak

Number of consecutive completions where the interval since the previous completion
was ≤ `frequencyDays × 1.25`.

The tolerance factor must be a centralized constant.

## Consistency Score

Over the selected period (default last90):

```text
consistencyScore = fulfillmentRatio × (1 - normalizedIntervalVariance)
```

Where `normalizedIntervalVariance` is the coefficient of variation of completion
intervals, capped at 1.

## Trend

```text
IMPROVING | STABLE | DECLINING
```

Comparing the consistency score of the current and previous period
(threshold ±0.1).

---

# Response (list)

```json
{
  "success": true,
  "data": {
    "householdConsistency": 0.81,
    "items": [
      {
        "tennerId": "tenner-003",
        "title": "Mobility Workout",
        "currentStreak": 11,
        "longestStreak": 18,
        "consistencyScore": 0.88,
        "trend": "STABLE"
      }
    ]
  }
}
```

`householdConsistency` is the mean consistency score across active Tenners
with at least two completions.

---

## Skipped and Snoozed Occurrences (added by SCHEDULING-004)

Skipped occurrences (`tenner-history` items with `eventType = SKIP`, `historyId` prefix `skip#`) count neither
as fulfilled nor as neglected: exclude each skipped cycle from the expected completions. Snoozes
(`eventType = SNOOZE`) move the due date but are not completions either. Neither event type appears in the
`completedAt` GSIs; read them with a base-table query on the `historyId` prefix (TD-028).

---

# Testing Requirements

```text
Streak Within Tolerance
Streak Broken
Longest Streak
Consistency Score
Variance Cap
Trend Classification
Insufficient Data
Undo Affects Streak
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/habits
GET /analytics/habits/{tennerId}
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

- Habit endpoints implemented
- Frequency-relative streaks calculated
- Consistency score and trend calculated as documented
- Insufficient data handled explicitly
- Tests passing

---

# Definition of Done

- Consistency over time is measurable
- Feature deploys through GitHub Actions

---

# Out of Scope

- Badges and rewards (FUTURE-006)
- Streak notifications
