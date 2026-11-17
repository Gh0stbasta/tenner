# MAINT-015: Meal rule — fish at most once a day

## Goal

The meal planner never plans fish for lunch and dinner on the same day.

## Context

Owner request (2026-11-17): „außerdem ne essensregel, dass fisch nicht zweimal am selben tag vorkommen darf.“ The
existing rules (FOOD-005) limit each protein form to once a week only while it is in the household's
`limitedProteinTags` (R7, editable), and R8 only looks at base ingredients (pasta, rice …), not at fish.

## Requirements

- New hard rule R14 „Fisch höchstens einmal am Tag“: a day whose lunch and dinner both contain fish is a violation of
  both meals.
- A dish contains fish when one of its required ingredients carries the `FISH` tag (catalog fish such as salmon, fish
  fingers, and own ingredients tagged „Fisch“); optional ingredients do not count.
- The planner, „Anderes Gericht“, the meal picker, swapping and the plan's rule hints all respect it (they use the
  shared rule functions).
- The rule is always on; it does not depend on the R7 protein settings.

## Acceptance Criteria

- [x] Fish for lunch and dinner on one day is a hard R14 violation of both meals
- [x] Fish on two different days is no R14 violation
- [x] Optional fish (e.g. a topping) does not count
- [x] The planner never produces such a day; replace and picker name the rule in their reasons
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `backend/src/meals/planner/rules.ts`: `R14` in `RULE_IDS`; `weekViolations` checks each day and
reports a hard R14 violation for both meals when both dishes have the `FISH` tag (`containsFish`, required ingredients
only). The planner, replace, picker and swap use `checkWeek` / `checkSlot`, so they respect it without own code; their
reason texts got entries for R14 (`planner.ts`, `meal-plan.service.ts`). The frontend shows the rule's message as
before. Tests: rule test (hard on both meals, independent of `limitedProteinTags`, not across days, optional fish
ignored, `checkSlot`) and a planner guard over 100 seeds without the weekly protein limit. The rule test fails without
the change; the planner guard also passes without it, because the seed catalog rarely offers a fish-fish day, so it
only guards against regressions. Validation: backend 1,147 tests, lint, typecheck. No new technical debt.

## Assumptions

- „Fisch“ means the allergen tag `FISH` of the ingredients (seafood such as shrimp carries `CRUSTACEANS` and is not
  covered).
- Already stored plans are not regenerated; an existing fish-fish day shows the R14 hint until the owner changes it.

## Out of Scope

- A switch for the rule in the rules dialog.
- Limits for other tags per day.
