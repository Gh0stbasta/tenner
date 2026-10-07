# FOOD-023: Meal History and Feedback

## Type

Full-Stack Feature

---

## Priority

Medium

---

## Phase

2.0 Extended

---

## Goal

Tenner knows what was really eaten and what the family liked, so the planner avoids repeats and prefers favorites,
and analytics can show favorite dishes.

---

# Background

Added by EPIC-FOOD-001: rule R12 („prefer dishes not eaten last week“) and FOOD-019 („Lieblingsgerichte“) need a
record of real meals, not only proposals.

---

# Dependencies

```text
FOOD-006
FOOD-009
```

---

# Scope

## Status and Feedback

- Slot status: `PLANNED` (default), `COOKED`, `SKIPPED` (e.g. eating out), `OTHER` (something else cooked).
  Past slots without a status count as `COOKED` for history after 2 days.
- Feedback per cooked slot: 👍 / 👎 (one per household, last one wins).
- Dish `favorite` flag (star in dish list and plan card).

## Use

- Planner (FOOD-005/006): soft bonus for favorites and 👍 history, soft penalty for 👎 and for dishes eaten in the
  last 7 days, stronger for the last 3 days.
- Plans are kept for 12 months (DynamoDB TTL), enough for analytics and seasons.

## UI

- Meal card: „Gekocht“ / „Ausgefallen“ / „Anderes gegessen“, then 👍 / 👎; favorite star.
- Dish list: „zuletzt gegessen am …“, how often in the last 3 months.

---

# Testing Requirements

```text
Status transitions and auto-cooked after 2 days
Feedback stored and changed
Planner weights favorites and recent dishes (seeded tests)
TTL set on plans
UI actions
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Status and feedback fields and endpoint (slot PUT)
Planner weighting
UI actions
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
```

---

# Acceptance Criteria

- [ ] Meals can be marked cooked, skipped or other, with 👍 / 👎
- [ ] Favorites can be marked
- [ ] Planner prefers favorites and avoids recent repeats
- [ ] History kept for 12 months
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Feedback is per household, not per eater (simpler; children's opinions are given by the parents).

---

# Out of Scope

- Ratings per eater, comments, photos of cooked meals.
