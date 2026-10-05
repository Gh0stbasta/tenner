# Analytics

Metric definitions of the `GET /analytics/*` endpoints. Code: `backend/src/analytics/` (pure aggregation functions in
`aggregations.ts`).

## Data and Computation (ANALYTICS-001)

- **Source:** completions from `tenner-history` (Query on `completedAt-index`, every page, no Scan, undone
  completions excluded) and the current Tenners from `tenner-tenners`. Everything is aggregated on the fly per
  request; pre-aggregation is ANALYTICS-010.
- **Dates:** all days are calendar dates in the household timezone (SCHEDULING-008). A completion belongs to the day
  of its `completedAt` in that timezone. Weeks start on the household's `weekStartsOn` (HOUSEHOLD-ADMIN-003).
- **Current state:** metrics marked *now* use the Tenners as they are today (assignee, category, due date), not as
  they were at completion time.
- **Ratios** are rounded to 4 decimals; a ratio with a zero denominator is `null`.

## Periods

Query parameters of every period-based endpoint:

| Parameter | Meaning |
|---|---|
| `period` | `week` (current week so far), `month`, `quarter`, `year` (current calendar month/quarter/year so far), `last30`, `last90` (ending today) |
| `from`, `to` | `YYYY-MM-DD`, inclusive. Only `from` → until today; only `to` → the 30 days ending there |

Rules: `period` and `from`/`to` exclude each other; default `last30`; `to` in the future is clamped to today;
`from <= to`; at most 366 days. Violations → `400 VALIDATION_ERROR`. The *previous period* is the period of equal
length immediately before.

## Summary — `GET /analytics/summary`

| Metric | Definition |
|---|---|
| `completions` | Completions (not undone) in the period |
| `totalActualMinutes` | Sum of `actualMinutes` of those completions |
| `activeTenners` | Active, not deleted Tenners *now* |
| `distinctTennersCompleted` | Tenners with at least one completion in the period (deleted Tenners count) |
| `overdueNow` | Active Tenners with `nextDue` before today *now*, excluding paused ones (individual pause or vacation) |
| `onTimeRate` | Completions on or before their due date ÷ completions that know their due date |
| `onTimeSamples` | Completions the on-time rate is based on |

**On-time limitation:** the due date at completion time (`previousNextDue`) is stored on completions since
ANALYTICS-001. Older completions do not have it and are left out of `onTimeRate`; it is `null` when no completion in
the period has it. A snoozed Tenner is due on its snooze date.

## Trends — `GET /analytics/trends` (ANALYTICS-002)

| Parameter | Meaning |
|---|---|
| `granularity` | `day`, `week` (default; starts on the household week start), `month` (calendar month) |
| `assignedTo` | only completions of Tenners *now* assigned to this member (`HOUSEHOLD` = shared Tenners) |
| `category` | only completions of Tenners *now* in this category |

| Field | Definition |
|---|---|
| `buckets[]` | One bucket per day, week or month overlapping the period, oldest first, including empty ones. `start` is the bucket's first day (the first bucket may start before the period); only days inside the period count |
| `completions`, `actualMinutes` | Completions in the bucket and the sum of their `actualMinutes` |
| `comparison.previousPeriodCompletions` | Completions in the previous period of equal length (same filters) |
| `comparison.changePercent` | (period − previous) ÷ previous × 100, one decimal; `null` when the previous period has none |

With a filter, completions of deleted Tenners are left out (their assignee and category are unknown).

## Members — `GET /analytics/users` (ANALYTICS-003)

One entry per household member from the member list (single source of truth, deactivated members included with
`active: false`), also without activity.

| Metric | Definition |
|---|---|
| `completions` | Completions with `completedBy` = member in the period |
| `actualMinutes` | Sum of `actualMinutes` of those completions |
| `assignedActive` | Active Tenners assigned to the member *now* |
| `assignedOverdue` | Of those, overdue *now* (not paused) |
| `completedForOthers` | Completions by the member of Tenners *now* assigned to another member (shared and deleted Tenners do not count) |
| `shared.assignedActive`, `shared.assignedOverdue` | The same counts for shared Tenners (`HOUSEHOLD`), which belong to nobody |

## Categories — `GET /analytics/categories` (ANALYTICS-004)

Every household category (HOUSEHOLD-ADMIN-002) in display order, archived ones included (`archived: true`), also
without activity. Completions count for the Tenner's *current* category; completions of deleted Tenners have no
category and are left out.

| Metric | Definition |
|---|---|
| `activeTenners` | Active Tenners in the category *now* |
| `completions`, `actualMinutes` | Completions in the period and their minutes |
| `shareOfMinutes` | Category minutes ÷ minutes of all categories (the shares sum to 1); `null` without minutes |
| `overdueNow` | Active Tenners overdue *now* (not paused) |
| `healthScore` | `1 − overdueNow ÷ activeTenners`; `null` without active Tenners |
