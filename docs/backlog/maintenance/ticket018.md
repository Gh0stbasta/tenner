# MAINT-018: Shorter shopping phrases for Alexa

## Goal

Adding to the shopping list by voice takes as few words as possible: the item alone, several items in one sentence,
and a shopping mode that keeps listening.

## Context

Owner request (2026-11-17): adding items must be a single move. Amazon keeps the Alexa shopping list closed to skills
(List Management API off since 2024-07-01, confirmed in Amazon's „Deprecated Features“ page of 2026-10-16), and
phrases with „schreib … auf“ or „Einkaufsliste“ go to Amazon's list even with „mit <Skill>“ (owner test 2026-11-17).
So the household list is reached with „Alexa, sag Mary Poppins, …“ (MAINT-017); this ticket makes that sentence short.

## Requirements

- Item only: „Alexa, sag Mary Poppins Milch“ adds Milch.
- Several items: „Alexa, sag Mary Poppins Milch, Eier und Butter“ adds up to five items in one sentence; the existing
  carriers („wir brauchen …“, „setz … auf die Einkaufsliste“) accept several items as well.
- Recognition of item words: a custom slot type with the catalog ingredient names and common household items; other
  words are still accepted (custom slot values are not a closed list).
- Items already open are not added again; the answer says which were new and which were already there.
- Shopping mode: „Alexa, sag Mary Poppins Einkauf“ (also „einkaufen“, „Einkaufsmodus“) asks „Was soll auf die
  Einkaufsliste?“; after each addition Alexa asks „Noch etwas?“ and keeps listening until „nein“, „fertig“ or „das
  war's“. Items said in the mode need no carrier phrase.
- One-shot requests outside the mode still end the session after the answer.

## Acceptance Criteria

- [x] Item-only and multi-item phrases add the items (one API call, duplicates skipped)
- [x] Shopping mode keeps the session open with „Noch etwas?“ and ends on „nein“ / „fertig“
- [x] The interaction model has the new slot type and samples; the existing intents keep working
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17).

- Interaction model: slot type `ShoppingProduct` (165 values: catalog ingredient names without brackets plus common
  groceries and household items); `AddShoppingItemIntent` got slots `item1` – `item5` with samples from „{item1}“ to
  „{item1} {item2} {item3} {item4} und {item5}“, alone and after the carriers („wir brauchen“, „setz … auf die
  Einkaufsliste“, „schreib … auf die Einkaufsliste“, „noch …“); new `ShoppingModeIntent` and `ShoppingDoneIntent`.
- Skill: `spokenNames` collects and splits the items (also at „und“, commas, „sowie“) and drops duplicates;
  `addItems` sends them in one change with keys derived from the request ID (`-1` … `-4` for further items);
  answers name new and already listed items. Dialog state `SHOPPING`: every answer ends with „Noch etwas?“; „nein“,
  „das war's“ and „fertig“ (a CompleteIntent sample, taken without task name) end it; single words that land on the
  task or member slot-only samples are added as items; unclear phrases are asked again.
- Tests: helpers, multi-item add with duplicates, the mode with fallback and end, slot-only words in the mode, model
  checks (slot rules for `AMAZON.SearchQuery`, slot type, intents). Validation: alexa 165 tests, lint, typecheck.
- Risk (documented in the alexa README): „sag Mary Poppins Milch“ outside the mode shares the slot-only sample with
  task completion and the speaker answer; Alexa decides by the slot values. The owner checks on the Echo.
- Owner device test (2026-11-17, after the MAINT-021 deploy): two items in one sentence work, more do not, and „wir
  brauchen Brot und Äpfel“ failed; accepted for now, recorded as TD-049.

## Assumptions

- Alexa splits „Milch Eier und Butter“ into slots only with the help of the slot values; unknown words next to each
  other may end up as one item. The owner checks on the Echo.
- The household creates an Alexa routine „Alexa, Einkauf“ → custom action „sag Mary Poppins Einkauf“ if wanted
  (documented, owner step).

## Out of Scope

- Syncing with Amazon's own list (not possible, see Context).
- Quantities by voice („zwei Liter Milch“ stays one item name).
