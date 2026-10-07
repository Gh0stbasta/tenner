# FOOD-008: Regenerate the Week

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

The whole week can be planned again in one action, while meals chosen or locked by hand and meals already eaten
stay as they are.

---

# Background

Owner breakdown FOOD-008. Typical reasons: new dishes added, profile changed, the proposal does not fit the week.

---

# Dependencies

```text
FOOD-006
FOOD-022 (locks)
FOOD-009 (UI)
```

---

# Scope

## API

```text
POST /meals/plans/{weekStart}/regenerate   (If-Match version)
```

- Keeps: locked slots, slots with `source: MANUAL`, slots in the past and slots with status `COOKED`.
- Replans all other slots with a new seed; returns the plan with a summary (`changed`, `kept`).
- Only the current and the next week.

## UI

- „Woche neu planen“ on the plan page with a confirmation that names how many meals change and which stay; undo via
  snackbar restores the previous plan version.

---

# Testing Requirements

```text
Kept slots unchanged (locked, manual, past, cooked)
Other slots replanned; hard rules hold across kept + new slots
New seed stored
Undo restores the previous plan
Version conflict → 409
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Regenerate endpoint
Plan page action with confirmation and undo
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

- [x] Whole week regenerated in one action
- [x] Locked, manual, past and cooked meals kept
- [x] Rules hold across kept and new meals
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

- Undo keeps the previous plan version in the client for the snackbar's duration (no server-side history of plan
  versions).
- **Undo through the same endpoint:** `{ "restore": [{ slotId, dishId }] }` puts back the previous dishes of the
  meals that changed; kept meals cannot be restored (400). The seed stays the new one.
- **No If-Match header:** optimistic locking on the stored plan version, like FOOD-007 and FOOD-022.
- **Summary:** `regeneration.changed` counts meals whose dish changed, `kept` the kept meals (past ones included).
- **Cooked meals:** no status can be set yet (FOOD-023); `isKept` already keeps `COOKED` and is unit-tested.
- **Confirmation text:** computed on the client with the same keep rule as the backend.

---

# Out of Scope

- Regenerating past weeks.

---

# Implementation Status

Done (2026-10-07).

- Backend: `MealPlanService.regenerateWeek` and `isKept` (`backend/src/meals/services/meal-plan.service.ts`), handler
  `regenerateWeekHandler` (`handlers/plans.ts`), route `POST /meals/plans/{weekStart}/regenerate` (Terraform
  `api_routes`).
- Frontend: „Woche neu planen“ with confirmation and undo in `MealPlanPage.tsx`, `useRegenerateWeek`, `isKept` in
  `format.ts`.
- Tests: `backend/tests/meals-plans.test.ts` (kept meals unchanged, rules hold, new seed, cooked, undo, 404, 409),
  route test, Terraform api test, `frontend/src/features/meals/MealPlanPage.test.tsx`.
