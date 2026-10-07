# SCHEDULING-002: Support Weekday-Based Scheduling

## Type

Backend + Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Allow Tenners to be due on specific weekdays, e.g.:

```text
Long Zwift Ride  → every Saturday
Date Night       → every second Friday
Bins out         → every Tuesday
```

---

# Background

Weekly Day-Based Scheduling was explicitly excluded from TICKET-013.

Some responsibilities are tied to a weekday rather than to the last completion.

---

# Dependencies

```text
SCHEDULING-001
```

---

# Scope

## Domain Model

Add optional:

```text
weekdays   array of MON..SUN (only valid with frequencyUnit = WEEK)
```

## Calculation

When `weekdays` is set:

```text
nextDue = first date after (completedDate + (interval - 1) weeks)
          whose weekday is in weekdays
```

Examples:

```text
Every Saturday, completed Sat 2026-10-03       → 2026-10-10
Every Saturday, completed late Mon 2026-10-05  → 2026-10-10
Every Tue+Fri, completed Tue 2026-10-06        → 2026-10-09
```

The calculation stays completion-based to remain consistent with the existing model.

## Frontend

For Weekly frequency, show weekday chips (Mon–Sun, multi-select).

---

# Testing Requirements

```text
Single Weekday
Multiple Weekdays
Bi-Weekly Interval
Late Completion
Early Completion
Week Boundary
Validation: weekdays without WEEK unit rejected
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain model extension
Calculation extension
API validation
Form weekday selector
Tests
Documentation
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

- Weekday-based Tenners supported
- Calculation matches documented examples
- Invalid combinations rejected
- UI weekday selection implemented
- Tests passing

---

# Definition of Done

- Weekday-bound responsibilities are modeled correctly
- Feature deploys through GitHub Actions

---

# Out of Scope

- "Nth weekday of month" rules (e.g. first Monday)
- Time-of-day scheduling

---

# Implementation Status

Implemented 2026-10-05.

- [x] Weekday-based Tenners supported: optional `weekdays` (`MON`..`SUN`) on WEEK frequencies in model, API
  (create, update, responses) and storage (read as `null` for older items or other units)
- [x] Calculation matches the documented examples (`backend/tests/weekdays.test.ts`): single and multiple
  weekdays, bi-weekly, late and early completion, week and year boundaries; implemented in `calculateNextDue`
- [x] Invalid combinations rejected: weekdays with another unit, with `frequencyDays`, without a unit in the same
  request, empty, duplicate or unknown values (400)
- [x] UI weekday selection: chips Mo–So shown for the unit "Wochen"; presets reset them; labels such as
  "Wöchentlich (Di, Fr)" and "Alle 2 Wochen (Fr)"
- [x] Tests passing: backend 526, frontend 259; lint and build clean; form checked in the browser at phone width
- [ ] Deploys through GitHub Actions: no infrastructure change; verified after merge

Decisions and assumptions:

- No weekdays selected means plain weekly recurrence (every n weeks after the completion).
- `frequencyDays` for weekday-bound frequencies is the average gap (rounded, at least 1), used for analytics only.
- Weekdays are stored and returned in ISO order regardless of the request order.
- The snooze maximum (SCHEDULING-003) uses the same calculation, so the 30-day minimum applies to short weekday rules.

Technical debt: none new.
