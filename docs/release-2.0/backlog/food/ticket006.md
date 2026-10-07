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

- [ ] 7 days × lunch and dinner planned automatically
- [ ] All hard rules hold; soft rules optimised
- [ ] Reproducible with the stored seed
- [ ] The plan exists before anyone opens the app (notifier)
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

- Week boundaries follow the household's week start and timezone.
- Notifier pre-creation requires `notifications_enabled`; without it, the plan is created on first read.

---

# Out of Scope

- Plans for more than one week ahead; breakfast.
