# ANALYTICS-002: Implement Completion Trends

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

Provide time-series data showing how many Tenners were completed and how much time
was invested per day, week or month.

Users must be able to answer:

```text
Am I more or less consistent than last month?
```

---

# Background

The architecture lists "Completed This Week", "Completed This Month" and
"Completion Rate" as dashboard metrics.

ANALYTICS-001 provides period handling and history loading.

---

# Dependencies

```text
ANALYTICS-001
```

---

# Scope

Implement:

```text
GET /analytics/trends
```

## Query Parameters

```text
from, to, period     (as ANALYTICS-001)
granularity          day | week | month   (default: week)
assignedTo           optional
category             optional
```

Weeks start on Monday (ISO 8601). Week start must be centralized as a constant
so that HOUSEHOLD-ADMIN-003 can make it configurable later.

---

# Response

```json
{
  "success": true,
  "data": {
    "granularity": "week",
    "buckets": [
      { "start": "2026-09-07", "completions": 48, "actualMinutes": 530 },
      { "start": "2026-09-14", "completions": 52, "actualMinutes": 601 }
    ],
    "comparison": {
      "previousPeriodCompletions": 180,
      "changePercent": 18.9
    }
  }
}
```

---

# Rules

- Buckets with zero completions must be included (no gaps).
- `comparison` compares the selected period with the immediately preceding period of equal length.
- `changePercent` is `null` when the previous period has zero completions.
- Bucket boundaries use the household timezone.

---

# Testing Requirements

```text
Daily Buckets
Weekly Buckets (ISO weeks)
Monthly Buckets
Zero-Filled Buckets
Period Comparison
Division By Zero
Filter By User
Filter By Category
Timezone Boundary (completion at 23:30 UTC)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/trends
Aggregation functions
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

- Trends endpoint implemented
- Day, week and month granularity supported
- No gaps in buckets
- Previous-period comparison returned
- Filters supported
- Timezone-correct bucketing
- Tests passing

---

# Definition of Done

- Trend data available for the analytics page
- Feature deploys through GitHub Actions

---

# Out of Scope

- Charts (ANALYTICS-009)
- Forecasting

---

# Implementation Status

Implemented 2026-10-05.

- [x] Trends endpoint: `GET /analytics/trends` (route in Terraform)
- [x] Day, week and month granularity; weeks start on the household's `weekStartsOn` (HOUSEHOLD-ADMIN-003, the
  centralized setting this ticket asked for), months are calendar months
- [x] No gaps: every bucket overlapping the period is returned, empty ones with zeros
- [x] Previous-period comparison: completions and `changePercent` (null when the previous period has none); one
  history query covers both periods
- [x] Filters `assignedTo` and `category`
- [x] Timezone-correct bucketing: completions are bucketed by their household-local date (23:30 UTC test)
- [x] Tests passing: backend 708; lint and build clean
- [ ] Deploys through GitHub Actions: one new API route; verified after merge

Decisions and assumptions:

- `assignedTo` and `category` filter on the Tenner's *current* values (TD-033); `assignedTo=HOUSEHOLD` selects
  shared Tenners. Completions of deleted Tenners count only without filters.
- The first bucket keeps its calendar start (e.g. the Monday before `from`) so charts align; it counts only days
  inside the period.
