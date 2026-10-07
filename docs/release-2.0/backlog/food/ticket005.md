# FOOD-005: Meal Planning Rules Engine

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

Every household rule is an explicit, tested rule that can check a single meal choice and a whole week, and explain
why a dish is not allowed.

---

# Background

The owner's rules R1 – R13 (EPIC-FOOD-001). The planner (FOOD-006), replace (FOOD-007), manual choice (FOOD-022)
and the plan page warnings all use the same engine, so rules are never implemented twice.

---

# Dependencies

```text
FOOD-002
FOOD-004
FOOD-021
```

---

# Scope

## Engine (`backend/src/meals/planner/rules.ts`)

Pure functions, no I/O:

```text
candidateFilter(dish, profile)                 → ok | reasons      (dish-level hard rules)
checkSlot(plan, slotId, dish, profile)         → ok | violations   (hard + soft, in week context)
checkWeek(plan, profile)                        → violations         (whole week)
score(plan, profile, history)                   → number             (soft rules and preferences)
```

Each violation: `{ rule: "R5", severity: HARD | SOFT, slotIds, message }` with a German message, e.g.
„Hühnchen nur Montag oder Dienstag abends“.

## Rules

| Rule | Implementation |
|---|---|
| R1 Allergy | dish allergen tags ∩ any eater's allergies = ∅ |
| R2 Suitable for all | every eater **present at the meal** (attendance, FOOD-004): vegetarian → dish vegetarian, or meat only in the exceptions, or `vegetarianVariant` set; R1 and R3 also apply to the present eaters |
| R3 Dislikes | dish tags/ingredients ∩ household and eater dislikes = ∅ |
| R4 Time | `activeMinutes ≤ maxActiveMinutes` |
| R5 Chicken | chicken dishes only in `chicken.allowedSlots`, at most `maxPerWeek` |
| R6 Burger | at most `maxBurgerPerWeek` dishes of category `BURGER_WRAP` with burger flag |
| R7 Protein | each tag in `limitedProteinTags` (default `POULTRY`, `BEEF_PORK`, `FISH`) at most once per week; egg, dairy and legumes not limited |
| R8 Base | the same `baseTag` at most once per day (`PASTA` incl. Spätzle; `GNOCCHI` and `SCHUPFNUDELN` separate) |
| R9 Light lunch | weekday lunches (adults only) only `LIGHT` dishes; weekend lunches unrestricted |
| R10 Warm dinner | soft: penalty for cold or light dinners |
| R11 Salad lunch | soft above `maxSaladLunchesPerWeek` (hard limit 2 × that value) |
| R12 Variety | hard: no dish and no group twice in a week; soft: penalty for dishes of last week |
| R13 Family-friendly | `familyFriendly = true` |
| Preferences | soft: bonus for favorites and likes, penalty for 👎 ratings (FOOD-023) |

Rule parameters come from the profile (FOOD-004), never from constants in the engine.

---

# Testing Requirements

```text
One positive and one negative test per rule (R1 – R13)
Chicken: Monday dinner ok, Wednesday dinner rejected, second chicken rejected
Vegetarian exception: Spaghetti Bolognese ok, Köttbullar ok only with variant
Attendance: weekday lunch checks only the adults; weekend lunch and dinner check all eaters
Protein: two fish dishes in one week rejected; Spaghetti Bolognese + Bratkartoffeln mit Würstl rejected (beef/pork); two egg dishes allowed
Base: pasta lunch + pasta dinner rejected; pasta lunch + rice dinner ok
Messages in German, rule IDs stable
Property test: checkWeek of a random valid plan reports no hard violation
```

Coverage for new code: 90% minimum (core logic).

---

# Deliverables

```text
Rules engine with all rules
Rule documentation in docs/architecture.md (table above)
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
```

---

# Acceptance Criteria

- [ ] All owner rules (R1 – R13) implemented and parameterised by the profile
- [ ] Every violation names the rule and the slots and has a German message
- [ ] Hard and soft rules distinguished
- [ ] Tests passing with 90% coverage

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

- „Hühnchen nur 1×“ means at most once, not exactly once (a week without chicken is valid).
- Protein and base groups follow EPIC-FOOD-001 decisions 3 and 4; beef and pork are one source.

---

# Out of Scope

- Nutrition targets as rules (only displayed, FOOD-012).
- Budget limits as rules (only displayed, FOOD-013).
