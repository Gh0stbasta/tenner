# PRODUCTIVITY-003: Implement Tenner Checklists

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

Allow a Tenner to contain a short checklist of steps.

Example:

```text
Clean Bathroom Sink
  □ Clear items
  □ Spray and wipe
  □ Polish faucet
```

---

# Background

Checklists help family members perform a Tenner consistently and make delegation easier.
They must not turn Tenners into projects: the "Ten-Minute First" principle remains.

---

# Dependencies

```text
TICKET-009
TICKET-011
FRONTEND-005
FRONTEND-009
```

---

# Scope

## Domain Model

```text
checklist   array of { id, text }  (max 10 items, text max 100 chars)
```

Checklist progress is **not** persisted between sessions; ticking items is
a UI aid only. Completing the Tenner remains a single action.

## Frontend

- Edit checklist in Edit dialog (add, remove, reorder).
- Show checklist in detail page and in an expandable dashboard row.
- When all items are ticked, highlight the Complete button.

---

# Testing Requirements

```text
Checklist Validation Limits
Create And Update Checklist
Reorder Items
UI Ticking Does Not Persist
Complete Highlight
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain and API changes
Checklist editor
Checklist display
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

- Checklists stored with limits enforced
- Checklists editable and visible
- Tests passing

---

# Definition of Done

- Tenners can carry simple instructions
- Feature deploys through GitHub Actions

---

# Out of Scope

- Persisted per-step progress
- Sub-Tenners or dependencies
