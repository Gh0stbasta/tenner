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

## Neglected Tenners — `GET /analytics/neglected` (ANALYTICS-006)

Active Tenners (not paused-out, not deleted), period default `last90`, `limit` 1–50 (default 10). Sorted by
`neglectScore` (highest first), then `daysOverdue`, then title; Tenners with score 0 are left out.

| Metric | Definition |
|---|---|
| `daysOverdue` | `max(0, today − nextDue)`; 0 while the Tenner is paused (individually or by the vacation) |
| `daysSinceCompleted` | Days since the last completion's household-local date; `null` if never completed |
| `expectedCompletions` | `floor(expected days ÷ frequencyDays) − skipped occurrences`, at least 0 |
| `actualCompletions` | Completions in the period |
| `fulfillmentRatio` | `actual ÷ expected`, capped at 1; 1 when nothing is expected yet |
| `neglectScore` | `(1 − fulfillmentRatio) × 0.6 + min(daysOverdue ÷ frequencyDays, 1) × 0.4` |

- **Expected days** run from the later of period start and the Tenner's creation date to the period end, minus days of
  the household vacation (if it covers the category) and of the Tenner's current individual pause (only the current
  pause is stored, SCHEDULING-005).
- **Skipped occurrences** (SCHEDULING-004) whose due date lies in the period each excuse one cycle. Snoozes only move
  the due date.
- **Never completed** Tenners older than one interval (and not paused now) are fully neglected: ratio 0, score 1.
- Weights are constants in `backend/src/analytics/neglect.ts`. `frequencyDays` is approximate for months and years.

## Household Balance — `GET /analytics/balance` (ANALYTICS-007)

Transparency, not competition: members are listed in member-list order, never ranked. Members: all active members
plus deactivated members with minutes in the period.

| Metric | Definition |
|---|---|
| `shareOfMinutes` | Member's `actualMinutes` (as `completedBy`) ÷ minutes of all listed members; `null` without minutes |
| `shareOfAssignedLoad` | Member's projected weekly minutes ÷ all; `null` without load |
| `byCategory[].shares` | Per household category: each member's share of the category's minutes; `null` without minutes |
| `balanceIndex` | `1 − (largest shareOfMinutes − smallest shareOfMinutes)`; 1 = perfectly even; `null` without minutes |

- **Projected weekly minutes** of an active Tenner: `estimatedMinutes × 7 ÷ frequencyDays` (same as ANALYTICS-005).
  It counts for the *current* assignee; shared Tenners (`HOUSEHOLD`) are split evenly between the active members, as
  on the dashboard.
- Categories are the Tenners' *current* categories.

## Habits — `GET /analytics/habits`, `GET /analytics/habits/{tennerId}` (ANALYTICS-008)

Consistency relative to each Tenner's own frequency ("Consistency Over Intensity"). Period default `last90`; active
Tenners only (details: any non-deleted Tenner). Constants are in `backend/src/analytics/habits.ts`.

| Metric | Definition |
|---|---|
| `currentStreak` | Completions in a row, each within `frequencyDays × 1.25` of the previous one, ending with the last completion; 0 if the last completion is already longer ago than that |
| `longestStreak` | Longest such run |
| `consistencyScore` | `fulfillmentRatio × (1 − normalized interval variance)` over the period; `null` with fewer than two completions in the period |
| `trend` | `IMPROVING` / `DECLINING` if the score changed by more than ±0.1 against the previous period, else `STABLE`; `null` if either score is `null` |
| `householdConsistency` | Mean `consistencyScore` of active Tenners that have one; `null` if none |

- **Fulfillment ratio:** as for neglected Tenners (expected completions without vacation, current pause and skipped
  occurrences), capped at 1; 1 when nothing is expected yet.
- **Normalized interval variance:** coefficient of variation (population standard deviation ÷ mean) of the days
  between consecutive completions in the period, capped at 1; 0 with a single interval.
- **Streak window:** streaks look back at most 366 days to keep history reads bounded.
- Undone completions are not in the history reads, so undoing a completion shortens or breaks a streak.
- Items are sorted by `consistencyScore` (highest first, `null` last), then title.

## Time Investment — `GET /analytics/time` (ANALYTICS-005)

| Metric | Definition |
|---|---|
| `totalActualMinutes` | Sum of `actualMinutes` in the period |
| `averageMinutesPerWeek` | `totalActualMinutes ÷ (period days ÷ 7)`, rounded |
| `projectedMinutesPerWeek` | Σ over active Tenners of `estimatedMinutes × 7 ÷ frequencyDays`, rounded |
| `estimationAccuracy` | Σ estimated ÷ Σ actual over completions with user-reported minutes; `null` without any (< 1: Tenners take longer than estimated) |
| `reportedSamples` | Completions with user-reported minutes in the period |
| `tennersExceedingEstimate` | Tenners whose median user-reported minutes exceed `estimatedMinutes × 1.5`, at least 3 samples; largest overrun first |
| `tennersExceedingTenMinutes` | Active Tenners with `estimatedMinutes` above 10 ("Ten-Minute First") |

**User-reported vs. defaulted minutes:** since ANALYTICS-005, completions store `actualMinutesSource`: `USER` when the
request sent `actualMinutes`, `DEFAULT` when the server used the estimate. Older records count as `DEFAULT`. The web
app does not send minutes (it has no input for them yet), so accuracy stays `null` until minutes can be entered
(TD-033). Estimates are the Tenners' current values.
