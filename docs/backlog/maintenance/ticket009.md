# MAINT-009: Tomorrow's dishes on „Für morgen einkaufen“

## Goal

The dashboard card „Für morgen einkaufen“ names tomorrow's two dishes in small text, so the shopping items have their
context.

## Context

Owner hotfix (2026-10-10): „bei "für morgen einkaufen" sollen klein die zwei gerichte nur mit text angezeigt werden“.
The card (UI-001) lists only the items that tomorrow's meals need.

## Requirements

- Below the heading, one small text line: „Mittag: <dish> · Abend: <dish>“ for tomorrow, text only (no photos, no
  links).
- Tomorrow comes from next week's plan when it is in the next week (as the list does).
- Meals without a dish are left out; without any dish the line is not shown.

## Acceptance Criteria

- [x] The card shows tomorrow's lunch and dinner names in small text
- [x] Works when tomorrow is in the next week
- [x] No line when tomorrow has no dishes
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-10). `ShoppingTomorrowCard` loads the plan of the week that contains tomorrow (`useMealPlan` got the same
optional `enabled` flag as `useShoppingList`) and shows „Mittag: … · Abend: …“ as `body2` in the secondary text color
below the heading; meals without a dish are left out, an empty line is not rendered. Tests: the dashboard tests check
the line for this week, for next week (Sunday) with an empty dinner, and its absence without a plan. Validation: lint,
typecheck, all frontend tests. No new technical debt; the current week's plan is the same cached query the „Heute
essen wir“ card uses, so no extra request in the normal case.

## Assumptions

- Skipped or replaced meals („Anderes gegessen“) still show the planned dish; tomorrow is not cooked yet.

## Out of Scope

- Items per dish (the list stays merged).
