# FOOD-009: Meal Plan Page

## Type

Frontend Feature

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

A page „Essen“ shows this week's plan at a glance — today first — on phone and desktop, also offline.

---

# Background

Owner breakdown FOOD-009 („Montag · Mittag Salat mit Protein · Abend Burgerwraps“). This is where the family will
look every day.

---

# Dependencies

```text
FOOD-006
MOBILE-003 (offline read cache)
```

---

# Scope

## Page `/essen`

- Navigation entry „Essen“ (bottom navigation on phones, MOBILE-005; sidebar on desktop).
- **Heute** card on top: lunch and dinner with dish name, image (FOOD-011), active time, vegetarian variant hint
  (e.g. „Vegetarisch: mit Veggie-Patty“, with the eater's display name from the profile), cost tier (FOOD-013).
- **Week view:** seven days × two meals; on phones a vertical list with day headers, today highlighted; on desktop a
  grid. Week switch: this week / next week.
- Meal card actions: „Anderes Gericht“ (FOOD-007), „Selbst wählen“, „Tauschen“, lock (FOOD-022), „Gekocht“ /
  „Ausgefallen“ (FOOD-023); „Woche neu planen“ (FOOD-008).
- Empty slot with the planner's reason and „Selbst wählen“.
- Rule warnings (soft violations) as small hints, never blocking.
- Dashboard (FRONTEND-002): small „Heute essen wir“ card linking to the page.

## Data

- TanStack Query keys under `meals`; add `meals` to the persisted query roots (MOBILE-003), so the plan is visible
  offline; changing actions are disabled offline with a hint.

## Quality

- German texts, light and dark theme, keyboard accessible, touch targets ≥ 44 px, loading and error states via the
  existing patterns (UX-005).

---

# Testing Requirements

```text
Renders week and today card from API data
Week switch
Offline: cached plan shown, actions disabled
Empty slot with reason
Responsive layout (phone list, desktop grid)
Dashboard card
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Page, components, API hooks
Navigation and dashboard card
Tests
```

---

# Validation

```bash
cd frontend && npm run lint && npm run typecheck && npm run build && npm test
```

---

# Acceptance Criteria

- [x] Weekly plan visible with today first
- [x] Works on phone and desktop, light and dark
- [x] Available offline (read)
- [ ] Entry points for all plan actions (added with FOOD-007, FOOD-022, FOOD-008; FOOD-023 later)
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

- Actions whose tickets are not done yet are hidden, not shown disabled.
- **Today = device date:** the page marks today by the phone's date (the household's timezone in practice); the plan
  itself is in household time.
- **Layout:** one card per day (lunch and dinner), one column on phones, two from `sm`, three from `lg`; today first.
- **Offline:** plans get their own query root `mealPlans`, so the offline cache keeps them but not the food profile
  with allergies (privacy, MOBILE-003). Plan actions need a connection; they come with the next tickets.
- **Images and cost tier** appear when FOOD-011 and FOOD-013 exist.

---

# Out of Scope

- Printing the plan; a fridge view (the Echo Show covers it, FOOD-018).

---

# Implementation Status

Done (2026-10-07); the plan actions are added by FOOD-007, FOOD-022 and FOOD-008.

- Page `frontend/src/features/meals/MealPlanPage.tsx`, `MealCard.tsx`, `TodayMealsCard.tsx`, `format.ts`; plan API
  in `features/meals/api.ts`; route `/essen`, navigation entry „Essen“, dashboard card.
- Offline: `mealPlans` in `PERSISTED_QUERY_ROOTS`.
- Tests: `MealPlanPage.test.tsx`, route, navigation and persistence tests.
