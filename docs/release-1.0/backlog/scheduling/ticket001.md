# SCHEDULING-001: Support Calendar-Based Frequencies

## Type

Backend + Frontend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Support the calendar frequencies listed in the architecture:

```text
Daily
Weekly
Every X Days
Monthly
Quarterly
Yearly
```

so that "Review finances monthly" stays on the same calendar day instead of drifting
by `30 days` intervals.

---

# Background

The current model stores only `frequencyDays` and calculates:

```text
next_due = last_completed + frequency_days
```

Daily, Weekly and Every X Days map cleanly to days. Monthly, Quarterly and Yearly do not:
months have 28–31 days.

The architecture explicitly forbids cron expressions and advanced rules.
This ticket keeps the model simple: a frequency **unit** plus an **interval**.

---

# Dependencies

```text
TICKET-008
TICKET-013
TICKET-014
FRONTEND-004
FRONTEND-005
```

---

# Scope

## Domain Model

Add to Tenner:

```text
frequencyUnit      DAY | WEEK | MONTH | YEAR   (default DAY)
frequencyInterval  integer ≥ 1                  (default frequencyDays)
```

Mapping:

```text
Daily        → DAY,   1
Weekly       → WEEK,  1
Every X Days → DAY,   X
Monthly      → MONTH, 1
Quarterly    → MONTH, 3
Yearly       → YEAR,  1
```

`frequencyDays` remains for backward compatibility and is derived for DAY/WEEK units.
For MONTH/YEAR units, `frequencyDays` stores an approximation (30 / 365) used only for
analytics ratios; it must not be used for due-date calculation.

## Due-Date Calculation

Centralize in one pure function:

```typescript
calculateNextDue(completedDate: LocalDate, unit: FrequencyUnit, interval: number): LocalDate
```

Month arithmetic clamps to the last day of the month:

```text
2026-01-31 + 1 MONTH → 2026-02-28
2028-01-31 + 1 MONTH → 2028-02-29
```

The Complete (TICKET-013) and Undo (TICKET-014) workflows must use this function.

## Migration

Existing Tenners without `frequencyUnit` are treated as `DAY` with
`frequencyInterval = frequencyDays`. No data migration required; provide a
read-time default and an optional idempotent backfill script.

## API

Create and Update APIs accept `frequencyUnit` and `frequencyInterval`.
Requests with only `frequencyDays` remain valid.

## Frontend

The Tenner form offers presets:

```text
Daily | Weekly | Every X Days | Monthly | Quarterly | Yearly
```

and displays frequency in human language ("Every 3 months").

---

# Testing Requirements

```text
All Presets
Month-End Clamping
Leap Years
Year Boundaries
Backward-Compatible Requests
Undo Restores Previous Due Date
Form Presets Mapping
Human-Readable Frequency Labels
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain model extension
calculateNextDue function
API changes (create, update)
Frontend form changes
Backfill script
Tests
docs/architecture.md (scheduling model)
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

- All six frequencies supported
- Calendar-correct month and year arithmetic
- Existing Tenners keep working unchanged
- Single due-date calculation function used everywhere
- Frontend offers presets
- Architecture documentation updated
- Tests passing

---

# Definition of Done

- Monthly and yearly Tenners stay on their calendar day
- Feature deploys through GitHub Actions

---

# Out of Scope

- Weekday-based rules (SCHEDULING-002)
- Cron expressions
- Fixed-schedule (non-completion-based) recurrence

---

# Implementation Status

Implemented 2026-10-05.

- [x] All six frequencies supported: `frequencyUnit` (`DAY`/`WEEK`/`MONTH`/`YEAR`) + `frequencyInterval` on the
  Tenner, in create/update requests and in every response
- [x] Calendar-correct month and year arithmetic: month-end clamping, leap years, year boundaries
  (`backend/tests/schedule.test.ts`)
- [x] Existing Tenners keep working unchanged: read-time default DAY / `frequencyDays`; requests with only
  `frequencyDays` stay valid; optional idempotent backfill `scripts/backfill_frequency_unit.py` (dry run by default)
- [x] Single due-date function `calculateNextDue` (`backend/src/utils/schedule.ts`), used by Complete and Undo
- [x] Frontend presets: Täglich, Wöchentlich, Alle 2 Wochen, Monatlich, Vierteljährlich, Jährlich, plus free
  interval + unit ("Alle X Tage"); human-readable labels ("Vierteljährlich", "Alle 2 Jahre") on cards and detail
- [x] Architecture documentation updated (`docs/architecture.md` → "Scheduling Model")
- [x] Tests passing: backend 481 (coverage 99.9 % lines), frontend 246, scripts 32; lint and build clean;
  form checked in the browser at phone width
- [ ] Deploys through GitHub Actions: no infrastructure change; verified after merge

Decisions and assumptions:

- Request forms: either `frequencyDays` or `frequencyUnit` (+ `frequencyInterval`, default 1). Sending both is
  rejected (400) instead of guessing which one wins. The frontend always sends unit + interval; Quick Add keeps
  sending `frequencyDays` (TD-027).
- Upper limit: 3650 approximate days (e.g. 120 months, 10 years), consistent with the existing limit.
- Completion-based recurrence stays: a monthly Tenner completed on 28 Feb continues from the 28th, not the 31st
  (fixed-schedule recurrence is out of scope).
- Optimistic locking is unchanged: a frequency change always changes `updatedAt`, which the complete/undo
  conditions already check.
- The backfill does not change `updatedAt`, so it cannot make concurrent completions fail.

Technical debt: TD-027 (default frequency in settings and Quick Add is days only).
