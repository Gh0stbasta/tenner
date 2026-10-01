# UX-001: Implement First-Run Onboarding

## Type

Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Help a new household get value from Tenner within the first five minutes
by offering a short onboarding with starter Tenners.

---

# Background

An empty dashboard does not communicate the Tenner idea. The architecture
explains it with examples ("Vacuum the office", "Mobility workout", ...).

Templates as a product feature are out of scope (FUTURE-004); this ticket ships
a small built-in starter set only.

---

# Dependencies

```text
FRONTEND-002
FRONTEND-004
PRODUCTIVITY-005 (bulk create) — or sequential creation via existing API
```

---

# Scope

## Trigger

Show onboarding when the household has zero Tenners (including inactive).

## Steps

```text
1. Welcome: "If something can be improved in 10 minutes, do a Tenner."
2. Choose areas: Household | Fitness | Family | Home | Personal | Finance
3. Pick starter Tenners (pre-selected suggestions per area, editable frequency)
4. Done → dashboard
```

## Starter Set

Static JSON in the frontend (~30 items), e.g.:

```text
HOUSEHOLD  Vacuum office (14d), Change bed sheets (14d)
FITNESS    Mobility workout (2d), Zone 2 ride (7d)
FAMILY     Date night (14d)
HOME       Clean exterior window sills (90d)
FINANCE    Review finances (30d)
```

Starter Tenners get initial `nextDue` spread over the next 14 days to avoid a
day-one overload.

## Skip

"Skip — I'll create my own" always available.

---

# Testing Requirements

```text
Shown For Empty Household
Not Shown When Tenners Exist
Area Selection
Starter Creation
Due Date Spreading
Skip Path
Accessibility Of Stepper
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Onboarding flow
Starter set JSON
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

- Onboarding shown only for empty households
- Starter Tenners created with spread due dates
- Skippable
- Accessible
- Tests passing

---

# Definition of Done

- New users understand Tenner and have a populated dashboard quickly
- Feature deploys through GitHub Actions

---

# Out of Scope

- Template marketplace (FUTURE-005)
- AI suggestions (AI-003)
