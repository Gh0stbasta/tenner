# FOOD-006: Automatic Weekly Planner

## Type

Backend Feature

---

## Priority

Critical

---

## Phase

2.0 Core

---

## Goal

For every week Tenner has a complete plan — seven days, lunch and dinner — that satisfies all hard rules, without
anyone pressing a button.

---

# Background

Owner vision: „The plan should already be generated.“ Plan creation on first read plus pre-creation by the notifier
(ADR 0007, FOOD-001).

---

# Dependencies

```text
FOOD-005
FOOD-003 (dishes to plan with)
```

---

# Scope

## Planner (`backend/src/meals/planner/planner.ts`)

```text
plan(input: { weekStart, dishes, profile, lockedSlots, history, seed }) →
  { slots: 14 × { slotId, dishId }, score, softViolations, relaxed: rule IDs }
```

- Deterministic for the same input and seed (seeded PRNG); the seed is stored with the plan.
- Constraint search with backtracking: fill the most constrained slots first (chicken slots, weekday lunches),
  candidates from `candidateFilter`, checked with `checkSlot`; several attempts with different seeds, best score
  wins.
- If no plan satisfies all rules: soft rules are dropped first; if hard rules still cannot be met, the slot stays
  empty with the reason („Zu wenige leichte Mittagsgerichte ohne Hühnchen“). Never a plan that breaks a hard rule.
- Runs in well under one second for 100 dishes (Lambda timeout safety).

## Plan Storage and Service

```text
PLAN#<weekStart>: { weekStart, slots[{ slotId, dishId|null, locked, source: AUTO|MANUAL,
                    status: PLANNED|COOKED|SKIPPED|OTHER }], seed, generatedAt, version }
```

- `GET /meals/plans/{weekStart}`: returns the plan; creates it with a conditional write if missing and the week is
  current or next week (no plans for the past, no plans further ahead than next week).
- Response includes dish summaries (name, image, time, vegetarian variant, cost tier) and current rule violations,
  so the page needs one request.
- The notifier creates next week's plan on the last day of the current week (same service).
- Archived dishes stay in existing plans; new plans use active dishes only.

---

# Testing Requirements

```text
Full week generated, 14 slots, no hard violation (100 seeded runs over the seed catalog)
Same seed → same plan
Impossible profile → empty slots with reason, no hard violation
Concurrent first reads create one plan (conditional write)
Past weeks and weeks beyond next week not created
Locked slots respected (input for FOOD-008)
Performance: < 1 s for 100 dishes
```

Coverage for new code: 90% minimum for the planner, 80% for the service.

---

# Deliverables

```text
Planner, plan repository and service, GET endpoint, notifier pre-creation
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
```

---

# Acceptance Criteria

- [x] 7 days × lunch and dinner planned automatically
- [x] All hard rules hold; soft rules optimised
- [x] Reproducible with the stored seed
- [x] The plan exists before anyone opens the app (notifier)
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

- Week boundaries follow the household's week start and timezone.
- Notifier pre-creation requires `notifications_enabled`; without it, the plan is created on first read.
- **Week reference:** the route accepts `current`, `next` or a week start date, so clients need not compute week
  boundaries.
- **No plan without setup:** while there are no active dishes or no eaters, nothing is planned or stored
  (`ready: false`, `setup` tells what is missing); otherwise a plan made before the family is entered would ignore the
  allergies and stay for the whole week.
- **Notifier:** prepares the current and next week on every scheduled run (two reads when both exist), not only on
  the last day; simpler and catches up after setup.
- **Search limits:** 6 attempts × 4,000 steps; with the seed catalog every tested seed finds a complete week in a few
  milliseconds.
- **TTL:** plans expire about 13 months after their week (FOOD-023 needs 12 months of history).

---

# Out of Scope

- Plans for more than one week ahead; breakfast.

---

# Implementation Status

Done (2026-10-07).

- Planner: `backend/src/meals/planner/planner.ts`, weeks: `planner/week.ts`; plans: `models/plan.ts`,
  `services/meal-plan.service.ts`, `handlers/plans.ts`; shared wiring `backend/src/meals/runtime.ts`.
- Route `GET /meals/plans/{weekStart}`; notifier `prepareMealPlans` in `backend/src/notifier.ts`; Terraform: notifier
  statement `MealPlans`, `MEALS_TABLE` for the notifier.
- Tests: `backend/tests/meals-planner.test.ts` (100 seeds without hard violations, reproducibility, fixed meals,
  empty reasons, last week, < 1 s for 100 dishes), `meals-plans.test.ts`, notifier test in `widget.test.ts`, route
  test, Terraform notifier test.
