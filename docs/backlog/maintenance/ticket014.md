# MAINT-014: Pantry items in the normal shopping list

## Goal

Pantry ingredients (salt, oil, flour, …) appear as normal entries in the generated shopping list instead of a separate
„Vorrat prüfen“ section.

## Context

Owner hotfix (2026-11-17): „bei der einkaufsliste, die element aus "vorräte prüfen" bitte einfach in die generierte
einkaufsliste schreiben.“ Since FOOD-014 pantry items are collapsed under „Vorrat prüfen“, left out of „Teilen“ /
„Kopieren“ as a separate block, and left out of the Echo Show widget, the voice read-out and the morning count.

## Requirements

- App: no „Vorrat prüfen“ section; pantry items are open items like all others (own order, drag and drop, tick off).
- Generation: pantry items are sorted into their shopping section like other items, no longer last.
- „Teilen“ / „Kopieren“ list them with the other items.
- Echo Show widget, Alexa read-out and the notification count include them.
- The ingredient's `pantry` flag stays; it still drives the flat cost estimate (FOOD-013). The API shape is unchanged.

## Acceptance Criteria

- [x] Pantry items show in „Einkaufen“, no „Vorrat prüfen“ section
- [x] Newly generated lists sort them by section, not last
- [x] Text for „Teilen“ / „Kopieren“ contains them in the list
- [x] Widget, Alexa and notification count include them
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

- Backend: `compareItems` and `insertionIndex` (`src/meals/shopping/shopping-list.ts`) no longer look at `pantry`;
  the widget (`src/alexa/widget.ts`) and the morning count (`src/notifier.ts`) count every unchecked item.
- Alexa skill: `openItems` (`alexa/src/shopping.ts`) reads pantry items like others.
- Frontend: `groupShoppingItems` returns `open` and `done` only; the „Vorrat prüfen“ accordion is gone; `shareText`
  lists every open item; the prices dialog hint no longer says pantry items are not in the list.
- Tests updated in all three packages (generation order by section, widget, Alexa read-out, page, share text).
  Validation: backend 1,145, frontend 512, alexa 160 tests; lint and typecheck in all three.
- Docs: frontend and backend README, architecture (morning count), CHANGELOG. No new technical debt.

## Assumptions

- Lists already stored keep their order; their pantry items stay where they are (at the end) until the list is
  refreshed („Liste aktualisieren“ or range switch) or moved by hand.
- The cost estimate keeps counting pantry ingredients as a flat amount.

## Out of Scope

- Removing the `pantry` flag from ingredients.
