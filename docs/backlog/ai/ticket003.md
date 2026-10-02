# AI-003: Implement Suggested Tenners

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

Suggest new Tenners that fit the household, based on existing Tenners and categories.

```text
You have "Clean windows" but no "Clean window frames" — add?
You track 5 fitness Tenners but no mobility work — add "Mobility workout"?
```

---

# Background

Users often only think of responsibilities when they are already overdue.
Suggestions help build a complete set of recurring responsibilities.

---

# Dependencies

```text
AI-001
UX-001 (starter set as baseline catalog)
```

---

# Scope

## Endpoint

```text
GET /ai/suggested-tenners?category=HOME&limit=5
```

Input to the model: existing Tenner titles, categories, frequencies (no history, no names).

Output: list of suggestions `{ title, category, frequency, estimatedMinutes, rationale }`.

## Rules

- Exclude suggestions semantically duplicating existing Tenners (model instruction + simple normalized title check).
- Rationale ≤ 140 characters.
- Cache suggestions per household for 7 days (avoid repeated cost).
- Dismissed suggestions are remembered and not suggested again.

## Frontend

"Suggestions" panel on the Tenner Management Page; one-tap "Add" opens prefilled Create dialog.

---

# Testing Requirements

```text
Schema Validation
Duplicate Filtering
Dismissal Memory
Cache Behavior
Feature Flag Off
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Suggestions endpoint
Prompt + schema
UI panel
Eval fixtures
Tests
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

- Relevant, non-duplicate suggestions returned
- Suggestions cached and dismissable
- User confirms before creation
- Tests passing

---

# Definition of Done

- Households discover responsibilities they had not captured

---

# Out of Scope

- Template marketplace (FUTURE-005)
