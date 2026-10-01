# HOUSEHOLD-003: Implement Household Activity Acknowledgements

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Allow household members to acknowledge each other's completed Tenners with a
lightweight "thank you" reaction.

---

# Background

Making invisible household work visible is valuable; appreciating it reinforces
consistency without introducing competition (no points, no rankings).

---

# Dependencies

```text
TICKET-020
FRONTEND-010
```

---

# Scope

## API

```text
POST   /history/{completionId}/thanks
DELETE /history/{completionId}/thanks
```

Rules:

```text
one acknowledgement per user per completion
users cannot thank themselves
stored separately from the immutable completion record
```

## Frontend

- "🙏 Thanks" button on entries in Recent Activity and History.
- Show who thanked.
- Optional digest line: "Julia thanked you for 3 Tenners this week" (NOTIFICATION-008).

---

# Testing Requirements

```text
Add Acknowledgement
Remove Acknowledgement
Duplicate Prevention
Self-Thanks Rejected
History Immutability Preserved
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Acknowledgement endpoints and storage
UI buttons
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

- Members can acknowledge each other's completions
- History records remain immutable
- Tests passing

---

# Definition of Done

- Household work receives visible appreciation
- Feature deploys through GitHub Actions

---

# Out of Scope

- Points, badges, leaderboards (FUTURE-006)
- Comments or chat
