# PRODUCTIVITY-002: Introduce Tenner Importance

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

Let users mark how important a Tenner is so that important responsibilities
surface first in the dashboard, suggestions and alerts.

---

# Background

All Tenners are currently equal. "Review finances" and "Dust bookshelf" have
very different consequences when neglected.

---

# Dependencies

```text
TICKET-009
TICKET-011
TICKET-016
FRONTEND-004
FRONTEND-005
```

---

# Scope

## Domain Model

```text
importance   LOW | NORMAL | HIGH   (default NORMAL)
```

Keep three levels only.

## Effects

```text
Dashboard sort within a section: importance desc, then nextDue asc
Suggestions (PRODUCTIVITY-001): importanceWeight
Overdue alerts (NOTIFICATION-004): HIGH alerts at minDaysOverdue = 0
Neglected analytics: HIGH importance shown with flag
```

Effects for not-yet-implemented features are implemented in those tickets;
this ticket implements the field, API, form and dashboard ordering.

## Frontend

Importance selector in Create/Edit forms; subtle visual marker for HIGH.

---

# Testing Requirements

```text
Default Importance
Create And Update With Importance
Invalid Value Rejected
Dashboard Ordering
Form Selector
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Domain and API changes
Dashboard ordering
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

- Importance stored and editable
- Dashboard ordering respects importance
- Backward compatible with existing Tenners
- Tests passing

---

# Definition of Done

- Important responsibilities surface first
- Feature deploys through GitHub Actions

---

# Out of Scope

- Numeric priorities
- Eisenhower matrix or deadlines
