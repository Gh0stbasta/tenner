# ANALYTICS-005: Implement Time Investment Metrics

## Type

Backend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Compare estimated effort with actual effort and show how much time Tenner
responsibilities really require.

Users must be able to answer:

```text
Are my ten-minute Tenners really ten minutes?
How much time per week does my household need for recurring responsibilities?
```

---

# Background

Tenners store `estimatedMinutes`; completions store `actualMinutes`
(defaulting to the estimate when not provided).

The "Ten-Minute First" design principle states most Tenners should take about ten minutes.

---

# Dependencies

```text
ANALYTICS-001
```

---

# Scope

Implement:

```text
GET /analytics/time
```

---

# Response

```json
{
  "success": true,
  "data": {
    "totalActualMinutes": 2380,
    "averageMinutesPerWeek": 555,
    "projectedMinutesPerWeek": 610,
    "estimationAccuracy": 0.91,
    "tennersExceedingEstimate": [
      {
        "tennerId": "tenner-007",
        "title": "Clean Windows",
        "estimatedMinutes": 10,
        "medianActualMinutes": 25,
        "samples": 4
      }
    ],
    "tennersExceedingTenMinutes": 6
  }
}
```

---

# Definitions

```text
projectedMinutesPerWeek     Σ over active Tenners: estimatedMinutes × 7 / frequencyDays
estimationAccuracy          Σ estimated / Σ actual for completions with explicit actualMinutes
tennersExceedingEstimate    median(actual) > estimated × 1.5, min. 3 samples
tennersExceedingTenMinutes  Active Tenners with estimatedMinutes > 10
```

Completions where `actualMinutes` was defaulted must be excluded from accuracy
calculations. If the history record does not record whether the value was defaulted,
add an `actualMinutesSource` attribute (`USER` | `DEFAULT`) to new completion records
and document that older records are treated as `DEFAULT`.

---

# Testing Requirements

```text
Projected Weekly Load
Estimation Accuracy
Defaulted Minutes Excluded
Median Calculation
Minimum Sample Size
No Data
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/time
Optional actualMinutesSource attribute
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

- Time investment endpoint implemented
- Projected weekly load calculated
- Estimation accuracy excludes defaulted values
- Tenners exceeding their estimate are listed
- Tests passing

---

# Definition of Done

- Real time investment is visible
- Feature deploys through GitHub Actions

---

# Out of Scope

- Automatic estimate adjustment
- AI-based splitting suggestions (AI-009)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Time investment endpoint: `GET /analytics/time` (route in Terraform)
- [x] Projected weekly load `Σ estimatedMinutes × 7 ÷ frequencyDays` over active Tenners (shared
  `projectedWeeklyMinutes`)
- [x] Estimation accuracy excludes defaulted values: new completions store `actualMinutesSource` (`USER` | `DEFAULT`),
  older records count as `DEFAULT`
- [x] Tenners exceeding their estimate (median > estimate × 1.5, at least 3 samples) listed
- [x] Tests passing: backend 754, frontend 309; lint and build clean
- [ ] Deploys through GitHub Actions: one new API route; verified after merge

Decisions and assumptions:

- The web app sent `actualMinutes = estimatedMinutes` on every completion, which would have made every default look
  user-reported. It now omits the field; the server stores the same value as `DEFAULT` (no visible change).
- There is no UI to enter actual minutes yet, so `estimationAccuracy` stays `null` for now (TD-033).
- `reportedSamples` shows how many completions the accuracy is based on.
