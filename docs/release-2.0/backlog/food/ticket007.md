# FOOD-007: Replace a Single Meal

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

2.0 Core

---

## Goal

One tap replaces one meal („Tausche Mittwoch Abend“) with another dish that fits all rules of the week.

---

# Background

Owner breakdown FOOD-007. The most frequent change to a plan: „darauf haben wir heute keine Lust“.

---

# Dependencies

```text
FOOD-006
FOOD-009 (UI)
```

---

# Scope

## API

```text
POST /meals/plans/{weekStart}/slots/{slotId}/replace   { "excludeDishIds": [...] }  (If-Match version)
```

- Picks the best-scoring candidate for the slot with all other slots fixed (`checkSlot`), excluding the current dish,
  its group and `excludeDishIds` (dishes already rejected in this session).
- Result: updated plan; `source: AUTO`, `locked: false`.
- No candidate → 409 `NO_ALTERNATIVE` with the blocking rules („Keine weitere leichte Mittagsmahlzeit ohne Ei“).
- Past slots (before today in household time) cannot be replaced.

## UI

- Meal card menu „Anderes Gericht“ on the plan page; repeated taps cycle through alternatives (the client sends
  the rejected IDs); undo via snackbar restores the previous dish.

---

# Testing Requirements

```text
Replacement satisfies all hard rules in week context
Current dish, group and excluded dishes never returned
No alternative → 409 with rule IDs
Past slot → 400
Version conflict → 409
UI: replace, cycle, undo
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Replace endpoint and service method
Plan page action
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

- [x] A single meal can be replaced in one action
- [x] Replacement respects all rules of the week
- [x] Clear message when nothing fits
- [x] Undo possible
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

- Replacing does not re-plan other slots; if the week has no room, the user picks by hand (FOOD-022).
- **Undo through the same endpoint:** `{ "dishId": … }` puts the previous dish back (checked against the hard rules),
  so undo works before FOOD-022 exists; no server-side history.
- **Choice:** best `score` of the week with the candidate (soft rules, favorites, last week), ties by name; the
  rejected dishes of the session make repeated taps cycle.
- **Error codes:** `NO_ALTERNATIVE` and `RULE_VIOLATION` (409), `MEAL_IN_PAST` (400) instead of the ticket's generic
  400 for past slots.
- **Slot IDs in URLs:** `#` is sent as `%23`; the handler decodes it if API Gateway does not.

---

# Out of Scope

- Voice replacement via Alexa (possible later via FOOD-017).

---

# Implementation Status

Done (2026-10-07).

- Backend: `MealPlanService.replaceMeal` (`backend/src/meals/services/meal-plan.service.ts`), handler
  `replaceMealHandler` (`handlers/plans.ts`), route `POST /meals/plans/{weekStart}/slots/{slotId}/replace`.
- Frontend: meal menu `MealActions.tsx`, „Anderes Gericht“ with undo in `MealPlanPage.tsx`, `useReplaceMeal`.
- Tests: `backend/tests/meals-plans.test.ts` (replace, cycle, undo, no alternative, past, conflict), route test,
  `frontend/src/features/meals/MealPlanPage.test.tsx`.
