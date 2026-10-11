# MAINT-011: Copy the shopping list with a button

## Goal

The shopping list can be copied as text with one button, on every device.

## Context

Owner request (2026-10-11): „Die einkaufsliste soll über nen button raus kopierbar sein“. „Teilen“ (FOOD-014) opens
the share sheet on phones and copies only where sharing is not available, so on the phone there is no direct copy.

## Requirements

- Button „Kopieren“ next to „Teilen“ writes the same text as „Teilen“ (title, open items in the own order, pantry
  items to check) to the clipboard.
- Confirmation „Einkaufsliste kopiert.“; an error message when the clipboard is not available.
- „Teilen“ stays as it is.

## Acceptance Criteria

- [x] „Kopieren“ copies the list text on every device, also where sharing exists
- [x] Confirmation and error message
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-11). `ShoppingListPage` has a `copy` action (clipboard, confirmation or „Kopieren hat nicht geklappt.“);
„Teilen“ uses it as its fallback, so both write the same `shareText`. Tests: copying while Web Share exists (share is
not called) and the missing clipboard. Validation: lint, typecheck, all frontend tests. No new technical debt.

## Assumptions

- Ticked items are not copied (same as „Teilen“).

## Out of Scope

- Other formats (Markdown checkboxes, CSV).
