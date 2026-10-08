# FOOD-027: Shopping List as Its Own Navigation Entry

## Goal

The shopping list is a main navigation entry „Einkaufsliste“ next to „Essen“, in the browser and in the phone app.

## Context

Owner request (2026-10-08): „die einkaufsliste muss in tenner ein eigener punkt neben essen sein.“ FOOD-014 placed
the list at `/essen/einkaufsliste`, reachable only from a button on the plan page, because the bottom navigation
already had five entries.

## Requirements

- Navigation entry „Einkaufsliste“ (shopping cart icon) directly after „Essen“ in the side and bottom navigation.
- The bottom navigation labels it „Einkauf“ (six entries share a phone's width); its accessible name stays
  „Einkaufsliste“.
- New address `/einkaufsliste`; the old `/essen/einkaufsliste` redirects there (bookmarks, installed app).
- On the list only „Einkaufsliste“ is highlighted, not „Essen“. The button on the plan page stays.

## Acceptance Criteria

- [x] Entry in side and bottom navigation, after „Essen“ (tested)
- [x] `/einkaufsliste` shows the list; `/essen/einkaufsliste` redirects (tested)
- [x] Only „Einkaufsliste“ is marked as current page (tested)
- [x] Tests passing (`cd frontend && npm run lint && npm test`)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (none)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- „Einkauf“ as short label on phones; six bottom entries still fit at 360 px width (labels are already shortened
  by MUI; touch targets stay ≥ 48 px wide).

## Out of Scope

- Changes to the list itself (FOOD-014), Alexa (FOOD-026).

---

# Implementation Status

Done (2026-10-08).

- `frontend/src/layouts/navigation.ts` (entry with `shortLabel`), `AppLayout.tsx` (icon, short label in the bottom
  navigation), `routes/AppRoutes.tsx` (route `/einkaufsliste`, redirect), link on `MealPlanPage.tsx`.
- Tests: `routes/AppRoutes.test.tsx`, `features/mobile/Mobile.test.tsx`.
