# MAINT-008: Plus button creates a task or a dish depending on the page

## Goal

The plus button (FAB, phone layout) creates what fits the open page: an Aufgabe on the task pages, a dish on the
meal pages.

## Context

Owner hotfix (2026-10-10): „der plus button in der app soll je nach gewählter seite aufgaben oder gerichte anlegen.
wenn ich die aufgaben offen habe, soll er aufgabe anlegen, bei essen entsprechend essen“. Today the button (MOBILE-005,
UI-001) always focuses the Quick Add for Aufgaben, or opens „Aufgaben“ with it.

## Requirements

- On „Essen“ (`/essen`, `/essen/gerichte`) the button is labelled „Gericht anlegen“ and opens the dish editor for a
  new dish on the dish page.
- Everywhere else the button keeps its behavior „Aufgabe schnell anlegen“.
- The dish page opens the editor for `?new=1` and removes the parameter when the editor closes, so „Zurück“ does not
  reopen it.

## Acceptance Criteria

- [x] On the meal plan and the dish page the plus button opens the editor for a new dish
- [x] On „Aufgaben“ and the other pages it still creates an Aufgabe (Quick Add)
- [x] Accessible name matches the action
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-10). `QuickAddFab` in `AppLayout.tsx` checks the path with `isDishPage` (`src/features/meals/newDish.ts`):
on `/essen` and `/essen/gerichte` it is labelled „Gericht anlegen“ and navigates to `/essen/gerichte?new=1`; elsewhere it
keeps the Quick Add for Aufgaben. `DishesPage` shows the editor for a new dish while `new` is in the URL and drops the
parameter (replace) when the editor closes; the open state is derived from the URL, not set in an effect. Tests: layout
tests for both meal pages and the shopping list, a dish page test for `?new=1` and the cleanup. Validation: lint,
typecheck, all frontend tests. No new technical debt.

## Assumptions

- The shopping list (`/einkaufsliste`, also reachable as `/essen/einkaufsliste`) is its own page and keeps the task
  behavior; adding shopping items has its own input on that page.
- The dashboard keeps the task behavior.

## Out of Scope

- A plus button on the desktop layout (the pages have their own buttons there).
- A plus button for shopping items.
