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

---

# Implementation Status

Implemented 2026-10-05.

- [x] Shared Tenners can be created and completed by anyone: `assignedTo = "HOUSEHOLD"` (`SHARED_ASSIGNEE`, reserved
  for members); "Alle (gemeinsam)" in the form, filters and the personal default assignee; completions keep
  `completedBy` = the member who did it
- [x] Dashboards and filters handle shared Tenners: member filters include shared Tenners (dashboard in memory, list
  with a second `assignedTo-index` query); cards mark them "Gemeinsam" with an icon; "Nach Person" counts them for
  every active member (`sharedCount`) and splits their minutes evenly
- [x] Tests passing: backend 645 (create shared, member filter includes shared, completion by any member, even split,
  assignedTo-index queries, reserved ID), frontend 298; lint and build clean
- [ ] Deploys through GitHub Actions: no infrastructure change; verified after merge

Decisions and assumptions:

- `HOUSEHOLD` is never a valid `completedBy` and cannot become a member ID.
- Even split rounds minutes per member; counts include each shared Tenner for every member, shown as
  "(davon N gemeinsam)".
- Notifications (NOTIFICATION-001) do not exist yet; that ticket now requires notifying all members.
- Deactivating a member can hand their Tenners to "Alle (gemeinsam)".
