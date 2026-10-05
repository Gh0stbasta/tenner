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
