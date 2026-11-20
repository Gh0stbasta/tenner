# MAINT-027: Shopping list widget shows only a bullet

## Goal

The Echo Show shopping list widget shows the open items and follows changes to the list.

## Context

Owner report (2026-11-20): the shopping list in the widget is not updated, and instead of a list only a single bullet
(„•“) is visible. The widget document built the item lines with data-driven children (`"data": "${shopping.items}"`,
child text `• ${data}`). Those children are inflated once when the document is shown; when the Data Store binding
delivers the list later, no new lines are created. The result is one line with an empty item, shown as a bare
bullet, and no visible updates. The meal widget uses fixed Text components bound to the Data Store object and works.

## Requirements

- The shopping list widget shows each item in a fixed Text slot bound to `shopping.items[0]` … `shopping.items[5]`
  (the backend sends at most six, `SHOPPING_WIDGET_ITEMS`); empty slots are hidden.
- No data-driven children in the shopping list document.
- New package version so the Echo devices load the changed document.
- Payload of the backend unchanged.

## Acceptance Criteria

- [x] The document has six item slots and no `data` binding or `${data}` text
- [x] Package version 1.1.0
- [x] Tests passing (alexa)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-20). `alexa/skill-package/dataStorePackages/shopping-list/documents/document.json`: six fixed Text slots
(`• <item>`, hidden when the slot is empty) instead of the data-driven Container; manifest version 1.1.0; test in
`alexa/tests/widget.test.ts`. alexa README and CHANGELOG updated. Validation: alexa 173 tests, lint and typecheck. The
rendering on the device is checked by the owner after the deploy (no APL renderer in CI). New technical debt: TD-050
(widget lag up to 15 minutes after quick changes; status widget list built the same way as the broken one).

## Assumptions

- The bare bullet comes from children inflated before the Data Store data arrived; not confirmed on the device, but
  the fixed-slot pattern is the one the working meal widget uses.
- The Echo may keep the old package until the widget is removed and added again.

## Out of Scope

- Faster pushes after quick changes (debounce, TD-050).
- The status widget's „next“ list (TD-050), not reported by the owner.
