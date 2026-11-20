# MAINT-028: Scrollable shopping list widget

## Goal

The Echo Show shopping list widget shows all open items in a list the owner can scroll, instead of six items and
„+ n weitere“.

## Context

Owner request (2026-11-20), after MAINT-027: „ich will nicht dass da +weitere kommt. ich will, dass man da scrollen
kann“. The widget showed at most six items (`SHOPPING_WIDGET_ITEMS`) and counted the rest. MAINT-027 learned that
data-driven children from the Data Store binding do not render on the Echo, so a scrollable list of components per
item is not an option; one bound Text inside a `ScrollView` is.

## Requirements

- The backend sends all open items, up to 40 (keeps the Data Store object small), and the items as one APL text
  (`text`: „• 2× Nudeln<br>• Milch“, `&`, `<`, `>` escaped); only beyond 40 the text ends with „+ n weitere“.
- `open`, `items` and `more` stay in the payload.
- The widget shows the title with the count, „Alles eingekauft.“ when the list is empty, and `shopping.text` in a
  `ScrollView` filling the rest of the widget; no „+ n weitere“ line and no data-driven children.
- New package version.

## Acceptance Criteria

- [x] Backend: all open items up to 40 in `items` and `text`, markup escaped, „+ n weitere“ only beyond 40
- [x] Widget: `ScrollView` with `shopping.text`, no „weitere“ in the template, no `data` binding; version 1.2.0
- [x] Tests passing (backend, alexa)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-20). `backend/src/alexa/widget.ts`: `SHOPPING_WIDGET_ITEMS` 40, new field `text`; widget document with
a `ScrollView` around one Text bound to `shopping.text`; manifest 1.2.0; sample and tests in `backend/tests/widget.test.ts`
and `alexa/tests/widget.test.ts`. alexa README and CHANGELOG updated. Validation: backend 1,152 tests, typecheck and
lint of the changed files; alexa 173 tests, lint and typecheck. Rendering and scrolling are checked by the owner on the
device. No new technical debt (widget lag after quick changes stays TD-050).

## Assumptions

- Amazon does not document whether a home-screen widget accepts swipes for scrolling; if the Echo does not scroll, the
  list is cut at the bottom of the widget. The owner checks this on the device.
- Until the next push (the next change to the list or the next household day) the device may still hold the old data
  without `text` and show an empty list; one change to the list refreshes it.
- 40 items are enough for a household week; more are counted.

## Out of Scope

- Ticking items in the widget (no tap action, MAINT-006).
- Faster pushes after quick changes (TD-050).
