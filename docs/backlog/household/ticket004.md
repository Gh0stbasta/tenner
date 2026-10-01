# HOUSEHOLD-004: Implement Temporary Handover

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Allow a household member to hand over their Tenners temporarily to another member
(e.g. during a business trip or illness) with automatic return.

---

# Background

Vacation mode (SCHEDULING-005) pauses Tenners when **nobody** is home.
When only one member is away, their Tenners should be covered by someone else
rather than paused.

---

# Dependencies

```text
HOUSEHOLD-ADMIN-001
PRODUCTIVITY-005
```

---

# Scope

## API

```text
POST   /users/{userId}/handover   { "to": "JULIA", "until": "2026-10-12", "categories": [...] }
DELETE /users/{userId}/handover
```

## Behavior

- Matching Tenners get `assignedTo = to` and `originalAssignee = userId`.
- At `until` (checked by the scheduled notifier job or on read), assignments revert.
- Manual reassignment during handover clears `originalAssignee` for that Tenner.

## Frontend

"Hand over my Tenners" dialog in the user's profile/settings with a summary preview.

---

# Testing Requirements

```text
Handover Applies
Automatic Revert
Manual Revert
Category Filter
Manual Reassignment During Handover
Rotating Tenners Interaction
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Handover endpoints
Revert job
UI dialog
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

- Tenners can be handed over temporarily
- Assignments revert automatically
- Tests passing

---

# Definition of Done

- Absences of one member are covered without manual bookkeeping
- Feature deploys through GitHub Actions

---

# Out of Scope

- Approval workflow for handover
