# MAINT-024: Meal widget shows long dish names on several lines

## Goal

Long dish names in the meal widget on the Echo Show are shown in full on several lines instead of being cut off.

## Context

Owner request (2026-11-17): „bei dem widget für die essensliste bitte so anpassen, dass die schrift nicht abgeschnitten
wird bei langen essennamen. einfach mehrzeilig dann“. The meal widget (FOOD-018) shows lunch and dinner with
`maxLines: 1`, so names like „Käsespätzle mit Röstzwiebeln“ end with „…“.

## Requirements

- Lunch and dinner names wrap onto up to three lines each.
- The dish text size goes from 34 dp to 30 dp so two three-line names fit the medium widget (`WIDGET_M`).
- Package version 1.1.0 → 1.2.0 so installed widgets update.

## Acceptance Criteria

- [x] Dish names have `maxLines` 3 and 30 dp text
- [x] Package version 1.2.0
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `meal-today/documents/document.json`: lunch and dinner `maxLines` 3, `dishSize` 30 dp;
`manifest.json` 1.2.0. Widget test checks lines, size and version. Validation: alexa 172 tests, lint, typecheck. The
deploy uploads the package; Echo devices update installed widgets with the new version. No new technical debt.

## Assumptions

- Three lines are enough for the catalog's longest names (about 45 characters); longer names still end with „…“.

## Out of Scope

- Photos in the widget, other widget sizes (Amazon offers only `WIDGET_M`).
