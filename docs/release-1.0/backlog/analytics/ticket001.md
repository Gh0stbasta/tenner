# ANALYTICS-001: Establish Analytics API Foundation

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

Create the backend foundation for all analytics features.

The architecture defines:

```text
GET /analytics
```

and lists "Analytics Aggregation" as a backend responsibility, but no ticket implements it.

This ticket provides a shared analytics module (time-range handling, history loading,
aggregation helpers) and a first summary endpoint. Subsequent ANALYTICS tickets add
specific metrics on top of this foundation.

---

# Background

Completion history is stored in `tenner-history` with the `completedAt-index`
(partition `tenantId`, sort `completedAt`).

Data volume for a household is small:

```text
~20 completions/day × 365 days ≈ 7,300 items/year
```

On-the-fly aggregation inside the Lambda is therefore sufficient and cheaper than
maintaining pre-aggregated tables. Pre-aggregation is deferred to ANALYTICS-010.

---

# Dependencies

```text
TICKET-008
TICKET-013
TICKET-014
TICKET-020
```

---

# Scope

Implement:

```text
GET /analytics/summary
```

and the shared module:

```text
backend/src/analytics/

├── period.ts          (period parsing & validation)
├── historyLoader.ts   (paginated Query on completedAt-index)
├── aggregations.ts    (pure aggregation functions)
└── analyticsService.ts
```

---

# Period Handling

## Query Parameters

```text
from     YYYY-MM-DD, optional
to       YYYY-MM-DD, optional
period   optional shortcut: week | month | quarter | year | last30 | last90
```

## Rules

```text
Default:         last30
Maximum range:   366 days
from <= to
Future 'to' clamped to today
```

Invalid combinations return `400 VALIDATION_ERROR`.

Dates are interpreted in the household timezone (default `Europe/Berlin`), see SCHEDULING-008.
Until that ticket exists, use a centralized constant.

---

# Summary Metrics

```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-09-01", "to": "2026-09-30" },
    "completions": 214,
    "totalActualMinutes": 2380,
    "activeTenners": 42,
    "distinctTennersCompleted": 37,
    "overdueNow": 4,
    "onTimeRate": 0.86
  }
}
```

## Definitions

```text
completions                 Completions (not undone) in period
totalActualMinutes          Sum of actualMinutes in period
activeTenners               Active, non-deleted Tenners now
distinctTennersCompleted    Tenners with ≥1 completion in period
overdueNow                  Active Tenners with nextDue < today
onTimeRate                  Completions on or before the due date / all completions
```

`onTimeRate` requires knowing the due date at completion time.
If the completion record does not store `dueAt`, extend the Complete workflow to persist
`previousNextDue` on new history records and compute `onTimeRate` only for records that
contain it. Document this limitation.

All metric definitions must be documented in `docs/analytics.md`.

---

# Aggregation Design

Aggregations must be implemented as pure, side-effect-free functions:

```typescript
summarize(completions: Completion[], tenners: Tenner[], period: Period): AnalyticsSummary
```

This allows exhaustive unit testing without DynamoDB.

---

# Performance

```text
Target p95 latency: < 1 second for 366-day range
```

Use `ProjectionExpression` to load only required attributes.

Do not use `Scan`.

---

# Testing Requirements

```text
Period Parsing (all shortcuts)
Invalid Period
Maximum Range Enforcement
Empty Period
Summary Calculation
Undone Completions Excluded
Deleted Tenners Handling
On-Time Rate With Missing Due Data
History Pagination Across Pages
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Analytics module
GET /analytics/summary
docs/analytics.md (metric definitions)
Tests
backend/README.md
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Analytics module exists with pure aggregation functions
- Summary endpoint implemented
- Period handling validated and documented
- No Scan operations
- Metric definitions documented
- Tests passing

---

# Definition of Done

- Analytics foundation available for follow-up tickets
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Trends, user, category or habit metrics (ANALYTICS-002 to 008)
- Analytics UI (ANALYTICS-009)
- Pre-aggregation (ANALYTICS-010)

---

# Implementation Status

Implemented 2026-10-05.

- [x] Analytics module with pure aggregation functions: `backend/src/analytics/` (`period.ts`, `historyLoader.ts`,
  `aggregations.ts`, `analyticsService.ts`); `summarize(completions, tenners, period, context)` has no I/O
- [x] Summary endpoint: `GET /analytics/summary` (route in Terraform)
- [x] Period handling validated and documented: shortcuts `week`, `month`, `quarter`, `year`, `last30`, `last90`,
  `from`/`to`, default `last30`, at most 366 days, future `to` clamped, household timezone and week start
- [x] No Scan: `CompletionRepository.listCompletions` pages through `completedAt-index` with a projection and the
  not-undone filter
- [x] Metric definitions documented in `docs/analytics.md`
- [x] Tests passing: backend 702 (period shortcuts, invalid periods, 366-day limit, empty period, summary, undone
  filter in the query, deleted Tenners, on-time rate without due data, pagination, timezone cut), Terraform 51;
  lint and build clean
- [ ] Deploys through GitHub Actions: one new API route; verified after merge

Decisions and assumptions:

- New completions store `previousNextDue` (due date at completion time); older ones are left out of `onTimeRate`,
  which is `null` without any samples. `onTimeSamples` shows the basis (TD-033).
- `overdueNow` excludes paused Tenners (individual pause or vacation), like the dashboard.
- Completions of deleted Tenners count in `completions` and `distinctTennersCompleted` (history stays).
- Dates come from the household settings (`HouseholdService.settingsOf`); the unused placeholder interface
  `AnalyticsService` in `src/services/` was replaced by the real module.
- Module file names follow the ticket (`historyLoader.ts`, `analyticsService.ts`).
