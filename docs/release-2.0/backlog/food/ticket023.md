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

- [x] Meals can be marked cooked, skipped or other, with 👍 / 👎
- [x] Favorites can be marked
- [x] Planner prefers favorites and avoids recent repeats
- [x] History kept for 12 months
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Feedback is per household, not per eater (simpler; children's opinions are given by the parents).
- Status and feedback have their own route `PUT /meals/plans/{weekStart}/slots/{slotId}/status`: the existing slot PUT
  (FOOD-022) only accepts future meals, while what was eaten is marked for today and earlier.
- The plan TTL (400 days, FOOD-006) already covers the 12 months; nothing changed there.
- „Recent“ counts every non-skipped meal before the week, including still planned meals of the current week (they
  will most likely be eaten), so next week's plan avoids them too.
- Weights: favorite +1, 👍 +1, 👎 −3, eaten within 7 days −2 (soft R12), within 3 days another −2.

---

# Out of Scope

- Ratings per eater, comments, photos of cooked meals.

---

# Implementation Status

Done (2026-10-10).

- Backend: `src/meals/history.ts` (effective status, history context, dish stats), `MealPlanService.records`,
  `ruleContext`, `setMealStatus`, `dishHistory`; rules use `lastEaten` and `likedDishIds` (R12 message „… gab es vor
  2 Tagen schon.“); routes `PUT …/slots/{slotId}/status`, `GET /meals/history` (Terraform).
- Frontend: `MealStatusControls` under today's and past meals, ⭐ on plan cards and as toggle on dish cards, history
  line on dish cards.
- Tests: `backend/tests/meals-history.test.ts` (auto-cooked, context, stats, weights, seeded planner preference,
  service transitions and errors, TTL), route tests; frontend plan page, dish list and `format.test.ts`.
- Validation: backend lint, typecheck, 1,139 tests; frontend lint, typecheck, build, 496 tests; Terraform api tests.
- Technical debt: none new (the history is read from up to ~57 stored plans per planning call; small and cheap).

