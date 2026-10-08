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

- [ ] „Was gibt es heute?“ answered with today's meals
- [ ] Tomorrow and single meals can be asked
- [ ] Briefing includes meals (no Echo Show view, MAINT-006)
- [ ] Skill stays private
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated (alexa/README.md)
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- The skill invocation stays „Familien Zentrale“; a one-shot phrase („Alexa, frag Familien Zentrale, …“) is the supported
  form. „Alexa, was gibt es heute?“ without the invocation name would need a name-free intent, which private skills
  do not get.

---

# Out of Scope

- Changing the plan by voice; reading the shopping list aloud (possible follow-up).
