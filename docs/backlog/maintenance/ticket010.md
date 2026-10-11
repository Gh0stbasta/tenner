# MAINT-010: Plus button adds a shopping item on the shopping list

## Goal

On the shopping list the plus button (phone layout) adds a shopping item instead of an Aufgabe.

## Context

Owner feedback on MAINT-008 (2026-10-11): „Ne, der Button soll auf der einkaufsliste nen einkaufsartikel anlegen.“
MAINT-008 kept the Aufgabe on the shopping list as an assumption; this ticket replaces that assumption.

## Requirements

- On `/einkaufsliste` and `/essen/einkaufsliste` the button is labelled „Einkaufsartikel hinzufügen“ and focuses the
  input „Eigener Eintrag“ of the list (scrolled into view).
- Without the input (list loading, no plan for the week) the button does nothing.
- Meal pages (MAINT-008) and all other pages keep their behavior.

## Acceptance Criteria

- [x] On the shopping list the plus button focuses „Eigener Eintrag“
- [x] Accessible name „Einkaufsartikel hinzufügen“
- [x] Other pages unchanged
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-11). `QuickAddFab` (`AppLayout.tsx`) picks its target by path: dish (MAINT-008), shopping
(`isShoppingPage` in `src/features/meals/shopping.ts`) or task. On the shopping list it focuses the input with
`SHOPPING_ADD_INPUT_ID` and scrolls it into view; without the input nothing happens. The layout test checks label and
focus on `/einkaufsliste` (replaces the MAINT-008 test that expected the Aufgabe there). Validation: lint, typecheck,
all frontend tests. No new technical debt.

## Assumptions

- Focusing the existing input is enough; typing and „Hinzufügen“ work as before (offline queue included).

## Out of Scope

- A separate dialog for shopping items.
