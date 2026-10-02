# HOUSEHOLD-ADMIN-004: Implement Member Deactivation

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

Allow a household member to be deactivated (e.g. a child moving out)
while preserving their history.

---

# Background

Completion history is immutable and references `completedBy`. Deleting members
would orphan history. Deactivation keeps history intact.

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
POST /users/{userId}/deactivate   { "reassignTo": "JULIA" }
POST /users/{userId}/reactivate
```

## Rules

```text
the last active member cannot be deactivated
active Tenners assigned to the member must be reassigned (reassignTo required if any exist)
rotations (HOUSEHOLD-001) remove the member
deactivated members cannot be assigned or complete Tenners
history keeps showing the member's display name
```

## Frontend

Deactivate action in member settings with a reassignment step and summary.

---

# Testing Requirements

```text
Deactivate With Reassignment
Reassignment Required
Last Active Member Protected
Deactivated Member Rejected In Validation
History Still Shows Name
Reactivate
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Deactivate/reactivate endpoints
Reassignment logic
UI flow
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

- Members can be deactivated and reactivated
- Open Tenners are reassigned
- History preserved
- Tests passing

---

# Definition of Done

- Household changes are handled without data loss
- Feature deploys through GitHub Actions

---

# Out of Scope

- Erasure of personal data (DATA-005)
