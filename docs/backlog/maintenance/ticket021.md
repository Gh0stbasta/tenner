# MAINT-021: Alexa slot names without digits (deploy fix)

## Goal

The deploy succeeds again: the interaction model of MAINT-018 passes Amazon's model build.

## Context

Deploy run 46 (2026-11-17, merge of PR #57) failed in „Terraform Apply“ when the skill package was uploaded:
„Slot name "item1" in intent "AddShoppingItemIntent" is invalid. Slot names must begin with an alphabetic character
and may only contain alphabetic characters, periods, and underscores.“ (same for item2 – item5, plus follow-up errors
for the samples). The manifest update reported `ROLLBACK_FAILED`. The repository tests did not check Amazon's slot
name rule.

## Requirements

- Rename the slots `item1` – `item5` to `itemA` – `itemE` in the model, the skill and the tests.
- A test checks every slot name of the model against Amazon's rule (letter first, then letters, periods, underscores).
- Re-run the deploy after the merge; the post-deploy health check („öffne mary poppins“) passes.

## Acceptance Criteria

- [x] No slot name with digits or other invalid characters (test)
- [x] Alexa tests passing
- [x] Deploy green after the merge (run 47: skill package imported, model built; the simulator check only warned, see TD-049)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17), except the deploy check, which follows the merge. Slots renamed to `itemA` – `itemE` in
`de-DE.json`, `handlers/shopping.ts` and the tests. New model test: every slot name matches `^[A-Za-z][A-Za-z._]*$`
and every `{slot}` in a sample is declared by its intent; the lowercase check for samples ignores the slot names in
braces. Validation: alexa 166 tests, lint, typecheck. No new technical debt; the gap (no check of Amazon's naming
rule) is closed by the test.

## Assumptions

- The failed upload left the development stage on the previous model (invocation „familien zentrale“); the next
  successful upload replaces model and manifest. If the console stays inconsistent, the owner re-runs the deploy.

## Out of Scope

- A full offline validation of Amazon's model rules.
