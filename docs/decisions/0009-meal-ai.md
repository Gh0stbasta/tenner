# ADR 0009: AI for Meal Planning

- **Status:** Proposed (2026-10-10) — evidence pending (8 weeks of use), then the owner's decision
- **Ticket:** FOOD-020 (evaluation, Long-Term)
- **Deciders:** repository owner (Stefan)

## Context

Release 2.0 plans meals deterministically (FOOD-005/006, ADR 0007). The owner's idea: „Später optional: KI für
Variationen, saisonale Gerichte, Resteverwertung.“ FOOD-020 asks to decide with evidence from real use. Since FOOD-023
the app records what was really eaten (cooked, skipped, other), 👍/👎, favorites and how often meals were replaced;
FOOD-019 shows it under Auswertung → Essen.

## Evidence (to collect)

After at least 8 weeks of use, read from Auswertung → Essen (period 12 Wochen):

| Signal | Where | Threshold that suggests a gap |
|---|---|---|
| Replaced by hand („selbst gewählt“) | Plan eingehalten | > 25 % of past meals |
| „Anderes gegessen“ | Plan eingehalten | > 15 % |
| 👎 share | Lieblingsgerichte / dish cards | many dishes with 👎 |
| Variety | Abwechslung | < 60 % distinct dishes per meal over 12 weeks |
| „Lange nicht gegessen“ | list | many dishes never chosen (catalog too big or rules too strict) |

As of 2026-10-10 the history started this week, so there is no evidence yet.

## Considered Options

| Option | What it solves | Data leaving the household's AWS | Cost | Notes |
|---|---|---|---|---|
| A. Deterministic additions: season tags on dishes (planner bonus in season), a „Reste“ category planned after dishes that leave leftovers, more variants per group | seasonal dishes, leftovers, variety | none | 0 € | fits the rules engine; no ADR beyond this one |
| B. Claude via Amazon Bedrock (EU inference): suggests new dishes and variations as drafts; the family confirms in the dish editor | new ideas, variations | dish names and categories only (no allergies, no names) | a few cents per suggestion; budget cap e.g. 2 €/month | Bedrock is not on the allowed-services list → ADR; IAM only, no key |
| C. External LLM API | as B | as B, outside AWS | as B | API key in Parameter Store; weaker data boundary than B |

Guardrails for any AI option (from the removed release 1.0 AI tickets): opt-in per household, budget cap with alarm,
minimal data (dish names, categories, season — never allergies, eaters or names), structured output validated against
the dish schema, the rules engine stays the authority (AI never plans directly), evals with a fixed set of prompts.

## Recommendation

1. Now: **A** for seasonal dishes and leftovers when the family asks for it (small tickets, no new service).
2. After 8 weeks: check the thresholds above. Only if variety or replacement rates show a gap that A cannot close,
   start **B** with a follow-up ticket (opt-in, budget cap, evals). C only if Bedrock is not available.

## Decision

Open until the evidence exists. Recheck date: 2026-12-07 (8 weeks after the history started).

## Consequences

- Release 2.0 stays AI-free (EPIC-FOOD-001).
- FOOD-020 stays open (status „waiting for evidence“), listed in the release notes as follow-up.

## Risks

- Without the recheck the decision is forgotten: the recheck date is in the release notes and the dashboard.
