# FOOD-019: Food Analytics

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

2.0 Extended

---

## Goal

A food section on the analytics page shows how the family eats: protein sources, vegetarian share, favorite dishes,
cost and variety over time.

---

# Background

Owner breakdown FOOD-019. The analytics page (ANALYTICS-009) and its on-the-fly aggregation pattern (TD-033) exist;
meal history comes from FOOD-023.

---

# Dependencies

```text
FOOD-023
FOOD-013
ANALYTICS-009
```

---

# Scope

## Endpoint

```text
GET /meals/analytics?period=4w|12w|1y
```

Computed on the fly from stored plans (cooked and planned-in-the-past slots):

| Metric | Definition |
|---|---|
| Protein sources | count per protein tag, incl. „ohne“ |
| Vegetarian share | share of meals that are vegetarian (without variants) |
| Favorite dishes | top 10 by cooked count and 👍 |
| Rarely eaten | active dishes not eaten in the period |
| Cost | estimated cost per week, average per meal |
| Variety | distinct dishes / meals; repeats per dish |
| Plan adherence | share of meals cooked as planned vs replaced, skipped, other |

## UI

- Analytics page tab „Essen“: protein bar chart, vegetarian share stat tile, favorites list, cost per week line
  chart, variety and adherence tiles; existing chart components and colors.

---

# Testing Requirements

```text
Each metric on fixed fixture plans
Periods and household timezone
Empty history → friendly empty state
UI renders with fixtures
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Analytics endpoint
Analytics tab „Essen“
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

- [x] Protein sources, vegetarian share, favorites and cost shown
- [x] Variety and plan adherence visible
- [x] Periods 4 weeks, 12 weeks, 1 year
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (docs/analytics.md)
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- At most 52 plans per year: on-the-fly aggregation is enough.
- „Replaced“ = meals chosen or swapped by hand (`source: MANUAL`); „Anderes Gericht“ (FOOD-007) keeps the planner's
  source and counts as planned.
- Cost per week is shown as columns (one per week from one baseline) instead of a line: few weeks for 4 and 12 weeks,
  and the existing chart primitives have no line chart; the table view lists every week.
- The tab keeps its own period buttons (4 Wochen, 12 Wochen, 1 Jahr); the Aufgaben period selector stays unchanged.
- Visual check in a real browser is left to the owner (tests render the tab with fixtures in jsdom).

---

# Out of Scope

- Nutrition analytics over time, comparisons between households.

---

# Implementation Status

Done (2026-10-10).

- Backend: `src/meals/analytics.ts` (`computeFoodAnalytics`), `MealPlanService.analytics`, route
  `GET /meals/analytics` (Terraform); meal records carry the slot source.
- Frontend: `features/analytics/FoodAnalytics.tsx`, tabs „Aufgaben“ / „Essen“ on the analytics page,
  `useFoodAnalytics`.
- Tests: `backend/tests/meals-analytics.test.ts` (every metric on fixed plans, portions, periods, empty history),
  route test; frontend `FoodAnalytics.test.tsx` (tiles, charts, table toggle, period change, empty state).
- Validation: backend lint, typecheck, 1,145 tests; frontend lint, typecheck, build, 498 tests; Terraform api tests.
- Technical debt: none new (aggregation pattern as TD-033).

