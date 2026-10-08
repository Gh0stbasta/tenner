# FOOD-028: Shopping List Shows Counts Instead of Weights

## Goal

The shopping list shows how many of something to buy („2× Hackfleisch“, „3× Zwiebeln“), never grams or millilitres.

## Context

Owner request (2026-10-08): „möchte ich, dass da keine mengenangaben wie 200g oder sowas stehen. es gibt nur 1-x stück
oder 1-x mal irgendwas.“ FOOD-014 summed the ingredients in grams or millilitres and rounded them to shop steps
(„450 g Hackfleisch“).

## Requirements

- Ingredients counted in pieces: the summed number of pieces, rounded up („3× Zwiebeln“).
- Weighed ingredients (g, ml): one per meal that needs them („2× Hackfleisch“ for two meals). The catalog has no pack
  sizes, so a meal counts as one pack.
- Own items stay without a quantity. Pantry items are counted the same way.
- Lists stored before FOOD-028 (with grams) are shown as counts. They are not marked as outdated just because of the
  format change.
- The share text uses the same counts („- 2× Nudeln“).

## Acceptance Criteria

- [x] Generated items carry counts (`unit` `Stück`) (tested)
- [x] Stored lists with grams are returned as counts, not stale (tested)
- [x] App and share text show „2×“, never grams (tested)
- [x] Tests passing (backend, frontend)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

## Assumptions

- **„1-x mal irgendwas“** means one per meal for weighed food. A big pack that covers two meals still shows „2×“.
  Pack sizes per ingredient could fix this later (with the dish editor, FOOD-010).
- The API keeps the fields `quantity` and `unit`. Clients that read them get counts with `unit` `Stück`.

## Out of Scope

- Pack sizes in the ingredient catalog.
- Quantities for own items (voice and app add names only).

---

# Implementation Status

Done (2026-10-08).

- Backend:
  - `backend/src/meals/shopping/shopping-list.ts`: `countOf` replaces `roundUp`; `normalizeItem` converts old items.
  - `services/shopping-list.service.ts`: stored lists are normalized and get a new signature when they are converted.
- Frontend: `features/meals/shopping.ts` (`formatQuantity` → „2×“).
- Tests: `backend/tests/meals-shopping.test.ts`, `frontend/src/features/meals/shopping.test.ts`, `ShoppingListPage.test.tsx`.
