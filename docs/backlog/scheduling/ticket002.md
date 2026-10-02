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
