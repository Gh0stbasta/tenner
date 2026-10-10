# FOOD-017: Alexa: „Was gibt es heute?“

## Type

Alexa Skill Feature

---

## Priority

High

---

## Phase

2.0 Extended

---

## Goal

Anyone in the kitchen asks „Alexa, frag Familien Zentrale, was es heute gibt“ and hears today's lunch and dinner; the
daily briefing and the Echo Show dashboard include the meals.

---

# Background

Owner breakdown FOOD-017. The private German skill „Familien Zentrale“ (ALEXA-001 – 010) calls the Tenner API with the
linked user's token; it never reads DynamoDB.

---

# Dependencies

```text
FOOD-006 (GET /meals/today)
ALEXA-002, ALEXA-003, ALEXA-005, ALEXA-006
```

---

# Scope

## Interaction Model (`alexa/skill-package`)

New intent `MealTodayIntent` with slot `day` (heute, morgen, AMAZON.DATE) and `meal` (Mittag, Abend):

```text
was gibt es heute
was gibt's heute zu essen
was essen wir heute abend
was gibt es morgen mittag
was kochen wir heute
```

## Answers (`alexa/src/meals.ts`)

- „Heute gibt es mittags Onigiri und abends Linseneintopf.“; one meal asked → only that one; empty slot → „Für
  heute Abend ist noch nichts geplant.“
- Vegetarian variant mentioned when set („Burger, für Vegetarier mit Veggie-Patty“).
- No APL card: since MAINT-006 the skill shows no views (owner decision, 2026-10-08); today's meals are on the
  Echo Show home-screen widget (FOOD-018).
- Daily briefing (ALEXA-005) gets a meal sentence.

## API

- `GET /meals/today?days=2` returns today and tomorrow in household time (FOOD-001).

---

# Testing Requirements

```text
Utterance and slot resolution (heute, morgen, Datum, Mittag, Abend)
Answers for full, partial and empty days
Variant wording
Briefing includes meals
API error → friendly fallback speech
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Intent and utterances
Answer builder
Briefing extension
Tests
```

---

# Validation

```bash
cd alexa && npm run lint && npm run typecheck && npm test
cd backend && npm test
scripts/check_alexa_simulation.py   (deploy health check, extended with one meal utterance)
```

---

# Acceptance Criteria

- [x] „Was gibt es heute?“ answered with today's meals
- [x] Tomorrow and single meals can be asked
- [x] Briefing includes meals (no Echo Show view, MAINT-006)
- [x] Skill stays private
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (alexa/README.md)
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- The skill invocation stays „Familien Zentrale“; a one-shot phrase („Alexa, frag Familien Zentrale, …“) is the supported
  form. „Alexa, was gibt es heute?“ without the invocation name would need a name-free intent, which private skills
  do not get.
- `GET /meals/today` did not exist yet (FOOD-001 only planned it); it is added here as a thin read over the current and
  next week's plan (`MealPlanService.mealsAhead`, `days` 1 or 2).
- The day slot is `AMAZON.DATE`; only today and tomorrow are answered, other days get a short pointer to the app.
- The deploy health check (`scripts/alexa-health-check.sh`) is not extended with a meal utterance: the simulator has
  no linked account, so a meal question would only test the „Konto verknüpfen“ answer. The launch check stays; the meal
  answers are covered by `alexa/tests/meals.test.ts` against the fake API.
- The briefing makes one extra API call; a failure there never breaks the briefing (sentence left out, logged).

---

# Out of Scope

- Changing the plan by voice; reading the shopping list aloud (possible follow-up).

---

# Implementation Status

Done (2026-10-10).

- Backend: `GET /meals/today?days=1|2` (`mealsTodayHandler`, `MealPlanService.mealsAhead`), Terraform route.
- Skill: `MealTodayIntent` with slots `day` (AMAZON.DATE) and `meal` (custom `MealSlot`) and 19 samples;
  `alexa/src/meals.ts` (answers, vegetarian variant, empty slots, day index, briefing sentence),
  `handlers/meals.ts`; the briefing adds today's meals after the Tenners. Private skill unchanged (ALEXA-010 test).
- Tests: `alexa/tests/meals.test.ts` (answers, slots, later days, API error fallback, briefing with and without
  meals, interaction model); backend route and service tests (`index.test.ts`, `meals-plans.test.ts`); Terraform
  route list.
- Validation: alexa lint, typecheck, 160 tests; backend lint, typecheck, 1,123 tests; Terraform api tests.
- Owner step: the interaction model is deployed with the skill by the deploy workflow; nothing to do by hand. To try:
  „Alexa, frag Familien Zentrale, was es heute gibt“.
- Technical debt: none new.

