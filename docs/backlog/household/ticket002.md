# HOUSEHOLD-002: Support Shared (Unassigned) Tenners

## Type

Full-Stack Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Allow Tenners that belong to the household as a whole and can be done by anyone.

Example:

```text
Empty dishwasher → whoever is first
Date night       → both together
```

---

# Background

Every Tenner currently requires an `assignedTo` user. Shared responsibilities
must be artificially assigned to one person.

---

# Dependencies

```text
TICKET-009
TICKET-011
TICKET-016
```

---

# Scope

## Domain Model

```text
assignedTo   userId | "HOUSEHOLD"
```

`HOUSEHOLD` is a reserved value, centralized as a constant.

## Behavior

- Dashboard filter by user includes shared Tenners (marked "Shared").
- Analytics attribute completions by `completedBy`; assigned-load metrics
  split shared load evenly across active members.
- Notifications for shared Tenners go to all members (deduplicated per user).

## Frontend

Assignment selector option "Anyone (shared)". Distinct visual marker.

---

# Testing Requirements

```text
Create Shared Tenner
Dashboard User Filter Includes Shared
Completion By Any Member
Analytics Even Split
Assigned-To Index Queries
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain and validation changes
Dashboard and list adjustments
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

- Shared Tenners can be created and completed by anyone
- Dashboards and filters handle shared Tenners
- Tests passing

---

# Definition of Done

- Household-wide responsibilities are modeled naturally
- Feature deploys through GitHub Actions

---

# Out of Scope

- Claiming a shared Tenner ("I'll do it")
