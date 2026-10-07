# FOOD-022: Choose, Swap and Lock Meals by Hand

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

The family stays in control: pick a dish for a meal, swap two meals (e.g. Tuesday and Thursday dinner), and lock
meals so regenerating the week keeps them.

---

# Background

Owner vision: „manually swap meals“. Added to the owner's breakdown by EPIC-FOOD-001; FOOD-008 needs the locks.

---

# Dependencies

```text
FOOD-005
FOOD-006
FOOD-009
```

---

# Scope

## API

```text
PUT  /meals/plans/{weekStart}/slots/{slotId}   { dishId?, locked? }          (If-Match version)
POST /meals/plans/{weekStart}/swap             { from: slotId, to: slotId }  (If-Match version)
```

- Choosing a dish sets `source: MANUAL`, `locked: true`.
- Hard-rule violations of a manual choice are **allowed but returned as warnings** („Hühnchen am Mittwoch –
  Regel R5“); allergy (R1) and suitability (R2) violations need an explicit `confirm: true`, because they can harm
  someone.
- Swap moves both dishes; warnings as above.

## UI

- „Selbst wählen“: searchable dish picker, sorted: fits all rules first, then dishes with warnings (reason shown);
  allergy conflicts with a red warning and a confirmation dialog.
- „Tauschen“: choose the other meal of the week.
- Lock icon on each card.

---

# Testing Requirements

```text
Choose sets manual + locked
Swap exchanges two slots
Warnings returned for rule violations
Allergy/suitability without confirm → 409, with confirm → saved with warning
Lock toggle
UI: picker sorting, warning dialog
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Slot update and swap endpoints
Picker, swap and lock UI
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

- [x] Any dish can be chosen for any meal
- [x] Two meals can be swapped
- [x] Locked meals survive regeneration (verified with FOOD-008)
- [x] Rule conflicts are shown; allergy conflicts need confirmation
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified (regeneration criterion with FOOD-008)
- [x] Git commit created

---

# Assumptions

- People may deliberately break a rule (e.g. chicken on a birthday); Tenner warns but does not forbid, except that
  allergy conflicts need a confirmation.
- **No If-Match header:** like FOOD-007, optimistic locking uses the stored plan version on the server; a parallel
  change answers 409 `CONCURRENT_MODIFICATION`.
- **Options endpoint:** the picker loads `GET …/slots/{slotId}/options` (every active dish with its violations at
  this meal), so sorting and warnings use the same rules as the planner; search filters on the client.
- **Swap confirmation:** only the violations of the two swapped meals count; R1/R2 conflicts there need `confirm`.
- **Swap targets:** any other meal of the week from today on, empty meals included (moves a dish).
- **Undo:** choose → `PUT` with the previous dish, its previous lock state and `confirm`; swap → the same swap again.
  Both meals stay manual (the original `source: AUTO` is not restored); acceptable, they only stay locked.
- **Lock labels:** „Festlegen“ / „Festlegung lösen“; a lock icon on the card shows locked meals (FOOD-009).

---

# Out of Scope

- Free-text meals without a dish (e.g. „Restaurant“); a skip status covers that (FOOD-023).

---

# Implementation Status

Done (2026-10-07); „Locked meals survive regeneration“ is verified with FOOD-008.

- Backend: `MealPlanService.mealOptions`, `chooseMeal`, `swapMeals` (`backend/src/meals/services/meal-plan.service.ts`),
  handlers in `handlers/plans.ts`, routes `GET …/slots/{slotId}/options`, `PUT …/slots/{slotId}`,
  `POST /meals/plans/{weekStart}/swap` (Terraform `api_routes`).
- Frontend: `MealPickerDialog.tsx`, `SwapMealDialog.tsx`, menu entries and confirmation in `MealPlanPage.tsx`,
  hooks `useMealOptions`, `useChooseMeal`, `useSwapMeals`; error text `CONFIRMATION_REQUIRED`.
- Tests: `backend/tests/meals-plans.test.ts` (choose, allergy confirmation, lock toggle, archived/past, swap, swap
  confirmation, options order), route test in `tests/index.test.ts`, Terraform api test,
  `frontend/src/features/meals/MealPlanPage.test.tsx` (picker sorting, search, confirmation, undo, swap, lock).
- Also: `SettingsPage` reset test got a 15 s timeout; the page now includes the meal sections and the test exceeded
  5 s in the full run (3.4 s alone).
