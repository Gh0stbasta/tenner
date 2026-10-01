# SCHEDULING-007: Implement Preferred Days (Rule-Based Smart Scheduling)

## Type

Backend + Frontend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow Tenners to prefer certain kinds of days, as described under
"Smart Scheduling" in the architecture:

```text
Prefer weekends
Avoid workdays
```

---

# Background

Some Tenners (wash car, clean windows) are realistically done on weekends.
If they become due on a Tuesday, they sit overdue until Saturday.

This ticket implements deterministic, rule-based preferences.
AI-based scheduling suggestions are covered by AI-005.

---

# Dependencies

```text
SCHEDULING-001
SCHEDULING-002
HOUSEHOLD-ADMIN-003 (household workdays configuration, optional)
```

---

# Scope

## Domain Model

```text
dayPreference   ANY | WEEKEND | WORKDAY   (default ANY)
```

## Calculation

After calculating `nextDue`:

```text
WEEKEND → shift forward to next Saturday if not Sat/Sun
WORKDAY → shift forward to next Monday if Sat/Sun
```

Shift must never exceed 6 days and is applied only for intervals ≥ 7 days
(shifting a daily Tenner makes no sense; validation rejects it).

Public holidays are out of scope.

## Frontend

Dropdown in Tenner form: "Any day | Weekends | Workdays".

---

# Testing Requirements

```text
Weekend Shift
Workday Shift
No Shift Needed
Short Interval Rejected
Interaction With Weekday Rules
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain extension
Calculation extension
Form changes
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

- Day preferences supported
- Shifts follow documented rules
- Invalid combinations rejected
- Tests passing

---

# Definition of Done

- Tenners become due on days they can realistically be done
- Feature deploys through GitHub Actions

---

# Out of Scope

- Public holiday calendars
- Load balancing across days (AI-005)
