# SCHEDULING-006: Support Seasonal Tenners

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

Allow Tenners to be active only during certain months of the year.

Examples:

```text
Mow lawn          → April – October
Clear gutters     → October – November
Check snow chains → November – March
```

---

# Background

Seasonal responsibilities are common in home ownership. Without seasons,
users must manually deactivate and reactivate Tenners twice a year.

---

# Dependencies

```text
SCHEDULING-001
SCHEDULING-005
```

---

# Scope

## Domain Model

```text
activeMonths   optional array of 1..12
```

Ranges crossing the year boundary (Nov–Mar) are represented as month sets.

## Behavior

- Outside the season the Tenner behaves as paused (reuse SCHEDULING-005 logic).
- At season start, `nextDue` is set to the first day of the season (spread per SCHEDULING-005).
- Completing outside the season is allowed (manual action) but does not schedule into off-season months.

## Frontend

Month selector in the Tenner form ("Only during: …"), seasonal badge in lists.

---

# Testing Requirements

```text
In Season
Out Of Season
Season Crossing Year Boundary
Season Start Scheduling
Next Due Skips Off-Season
Validation Of Month Values
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain extension
Season-aware scheduling
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

- Seasonal Tenners supported
- Off-season Tenners not shown as due
- Season start scheduling works
- Tests passing

---

# Definition of Done

- Seasonal responsibilities need no manual reactivation
- Feature deploys through GitHub Actions

---

# Out of Scope

- Weather-based scheduling
- Location-based seasons
