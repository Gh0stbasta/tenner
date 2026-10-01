# HOUSEHOLD-001: Implement Rotating Assignment

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

Allow a Tenner to rotate automatically between household members after each completion.

Example:

```text
Clean Bathroom → Stefan, then Julia, then Stefan, ...
```

---

# Background

Many shared chores are fairly split by alternating. Today, users must manually
reassign after each completion.

---

# Dependencies

```text
TICKET-013
TICKET-014
HOUSEHOLD-ADMIN-001 (member list)
```

---

# Scope

## Domain Model

```text
assignmentMode   FIXED | ROTATING   (default FIXED)
rotation         ordered array of userIds (min 2), required for ROTATING
```

## Behavior

```text
On completion: assignedTo = next user in rotation after the current assignedTo
On undo:       assignedTo restored to the previous value
```

Rotation advances based on the **assigned** user, not the user who completed it,
so that "covering" for someone does not break the rotation.

Deactivated members (HOUSEHOLD-ADMIN-004) are skipped.

## Frontend

Assignment field offers "Rotate between: [members]".
Lists show "Next: Julia".

---

# Testing Requirements

```text
Rotation Advances
Rotation Wraps Around
Completion By Other User
Undo Restores Assignee
Deactivated Member Skipped
Validation Minimum Two Members
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain extension
Complete and Undo workflow updates
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

- Rotating Tenners alternate assignees
- Undo restores the previous assignee
- Covering does not break rotation
- Tests passing

---

# Definition of Done

- Shared chores rotate fairly without manual work
- Feature deploys through GitHub Actions

---

# Out of Scope

- Load-based automatic assignment (AI-006)
