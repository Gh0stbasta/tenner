# MAINT-022: „Tafel“ — full-screen overview for the Echo Show browser

## Goal

A page of the web app made for a large screen (Echo Show 21 in its Silk browser): this week's meals with photos,
today's Aufgaben and the shopping list at one glance, without the app's navigation.

## Context

Owner request (2026-11-17): the Echo Show widget is too small (Amazon allows only `WIDGET_M` for skill widgets,
APL package reference) and a skill's own views time out (Web API for Games: at most 300 s without interaction). The
owner wants „eigenes System“ on the Echo Show 21: our page in Silk, opened by voice (MAINT-023).

## Requirements

- Route `/tafel`, signed in like every page, shown without the app bar and navigation (full screen).
- Header: weekday and date, clock (minutes).
- Meals: switch „Heute“ / „Woche“ (remembered on the device).
  - Heute: lunch and dinner with large photos (category placeholder without photo) and dish names.
  - Woche: Monday – Sunday of the current plan week, each day with lunch and dinner (small photo and name), today
    highlighted.
- Aufgaben: today's open Aufgaben (due today and overdue) by title, count of done today.
- Einkaufsliste: open items with counts (first 15, then „+ n weitere“).
- Readable from a distance (large type), touch-friendly; dark background.
- Refreshes itself every 5 minutes; asks the browser to keep the screen on where it can (Screen Wake Lock), without
  failing where it cannot.
- Empty states (no plan, nothing due, empty list) and load errors shown in place, not as a blank page.

## Acceptance Criteria

- [x] `/tafel` shows meals, Aufgaben and the shopping list full screen
- [x] „Heute“ / „Woche“ switch, remembered
- [x] Self-refresh and wake lock (where supported)
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `src/features/tafel/TafelPage.tsx` (route `/tafel` inside `AuthGate`, outside `AppLayout`) with
helpers in `tafel.ts` (view switch in `localStorage`, days of the plan, shopping limit, German date formats). Uses the
existing queries (`useMealPlan("current")`, `useDashboard`, `useShoppingList("current")`) and `DishImage`; own dark
theme; `invalidateQueries` every 5 minutes; Screen Wake Lock with re-request on visibility, failures ignored.
Tests: helpers (storage errors, day order, limit), page (today, week switch remembered, today highlighted, empty and
error states, refresh), route without navigation. Validation: lint, typecheck, 519 frontend tests. Not yet seen on
the Echo Show 21 (owner check together with MAINT-023). No new technical debt.

## Assumptions

- Silk on the Echo Show keeps the sign-in (Google via Cognito) like any browser; the owner signs in once.
- Read-only: ticking off happens in the app or by voice; the Tafel shows the state.

## Out of Scope

- Opening the page by voice (MAINT-023).
- Several households, per-device settings beyond the remembered switch.
