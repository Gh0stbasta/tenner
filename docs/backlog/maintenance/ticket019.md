# MAINT-019: Ticked shopping items stay „vorhanden“ for the week

## Goal

Something ticked off the shopping list in a calendar week counts as available for that week: it does not come back
on the list when the meal plan changes and the list is refreshed.

## Context

Owner hotfix (2026-11-17): „wenn ich innerhalb einer kalenderwoche etwas in der einkaufsliste abgehakt habe, will
ich, dass das als "vorhanden" abgespeichert ist und selbst bei änderung des essensplans nicht neu auf der
einkaufsliste auftaucht.“ Today a refresh (`mergeRefresh`, FOOD-014) keeps ticks only for items that are still
needed; an item that drops out and is needed again later comes back unticked. Related: MAINT-020 deletes ticked
items, which must not bring them back either.

## Requirements

- The week's list (`LIST#<weekStart>`) stores `bought`: the keys of planned (ingredient) items ticked off this week.
- Ticking a planned item adds its key; unticking removes it (the person says it is missing after all). Removing a
  planned item also counts as available.
- A refresh (plan change, „Liste aktualisieren“, range switch) does not add a planned item whose key is in `bought`;
  items still on the list keep their tick as before.
- Lists stored before this change: their ticked planned items count as `bought`.
- Own items (`manual-…`) are not affected. The API response is unchanged.

## Acceptance Criteria

- [x] A ticked item that leaves the list with a plan change does not come back when the plan needs it again
- [x] Unticking makes the item come back on a later refresh
- [x] Old lists without `bought` work
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `StoredShoppingList.bought` (`backend/src/meals/shopping/shopping-list.ts`); `boughtAfter` updates
it from the operations (check → add, uncheck → remove, remove → add; planned items only), `boughtOf` derives it for
lists stored before (their ticked planned items); `mergeRefresh` skips generated items whose key is in `bought`,
items still on the list keep their tick. `ShoppingListService` stores it with every change and passes it to the
refresh. Tests: pure functions, service flow (tick → plan needs it again → stays away; untick → comes back; old list
without `bought`). Both new service tests fail without the change. Validation: backend 1,151 tests, lint, typecheck.
API response unchanged. No new technical debt.

## Assumptions

- „Kalenderwoche“ is the plan week (household week start); a new week starts with an empty `bought`.
- More meals needing an available item do not add it again („vorhanden“ wins over quantities).

## Out of Scope

- A stock across weeks.
- Showing `bought` in the app.
