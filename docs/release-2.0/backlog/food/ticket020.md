# FOOD-020: Evaluate an AI Planning Engine

## Type

Evaluation / Architecture

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Decide with evidence whether an AI extension adds enough value to the deterministic planner: dish variations,
seasonal dishes and using up leftovers.

---

# Background

Owner breakdown FOOD-020: „Später optional: KI für Variationen, saisonale Gerichte, Resteverwertung.“ Release 2.0
is deliberately AI-free (EPIC-FOOD-001). The release 1.0 AI tickets were removed (BACKLOG-003); their guardrail
ideas (budget, minimal data, structured output, opt-in) are the starting point.

---

# Dependencies

```text
FOOD-006 and FOOD-023 in use for at least 8 weeks (data on what the deterministic planner lacks)
```

---

# Scope

## Questions

1. What does the family miss after 8 weeks? (Feedback from FOOD-023: replace rate, 👎, „Anderes gegessen“.)
2. Can deterministic additions solve it? Seasonal tags on dishes, a „Reste“ dish category, more variants.
3. If AI: which use cases, which data leaves AWS, cost per month, failure behaviour.

## Options

| Option | Notes |
|---|---|
| A. Deterministic only (seasonal tags, leftover dishes) | no new service |
| B. Claude via Amazon Bedrock (EU inference) for suggestions of new dishes and variations, user confirms | IAM, no key; ADR needed (not on the allowed-services list) |
| C. External LLM API | API key in Parameter Store; ADR needed |

The AI never plans directly: it proposes dishes or variants; the rules engine (FOOD-005) stays the authority.

## Output

- `docs/decisions/00xx-meal-ai.md` with go/no-go; if go: follow-up tickets with budget, opt-in, data minimisation
  (no allergies or names sent), evals.

---

# Deliverables

```text
Evaluation document / ADR with decision
Follow-up tickets if go
```

---

# Acceptance Criteria

- [ ] Decision documented with evidence from real use
- [ ] Deterministic alternatives considered first
- [ ] If go: cost, privacy and guardrails defined

---

# Definition of Done

- [ ] Evaluation completed
- [ ] Documentation updated
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- No implementation in this ticket.

---

# Out of Scope

- Building AI features.
