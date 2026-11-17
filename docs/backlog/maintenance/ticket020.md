# MAINT-020: Button „Abgehakte Einträge löschen“

## Goal

The shopping list has a button that removes all ticked entries at once.

## Context

Owner request (2026-11-17): „außerdem soll es noch einen button geben mit "abgehakte einträge löschen"“. Ticked
entries collect in „Erledigt“ at the end of the list (FOOD-014); today each one has to be removed by hand.

## Requirements

- Button „Abgehakte Einträge löschen“ in the „Erledigt“ section, shown while it has entries.
- One change with a `remove` operation per ticked entry (works offline through the change queue like every change).
- Confirmation as a snackbar („3 Einträge gelöscht.“).
- Removed planned items stay „vorhanden“ for the week and do not come back with a refresh (MAINT-019, server side).

## Acceptance Criteria

- [x] The button removes every ticked entry, own entries included, in one change
- [x] Open entries stay
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `ShoppingListPage`: button in the „Erledigt“ header sends one change with a `remove` per ticked
entry through `useShoppingChanges` (offline queue) and shows „n Einträge gelöscht.“. The server records removed
planned items in `bought` (MAINT-019). Test: two ticked items removed in one change, open items stay. Validation:
lint, typecheck, all frontend tests. No new technical debt.

## Assumptions

- No confirmation dialog: ticked entries are done, and planned items stay remembered as available.

## Out of Scope

- Undo.
