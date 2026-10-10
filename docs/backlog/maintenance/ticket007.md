# MAINT-007: Meal plan always Monday to Sunday

## Goal

The meal plan page shows the days of the week in calendar order (Monday – Sunday); today is highlighted but no longer
moved to the top.

## Context

Owner hotfix (2026-10-10): „beim essensplan die reihenfolge immer montag - sonntag in der app anzeigen, nicht den
heutigen tag zuerst“. FOOD-009 put today's card first (CSS `order: -1`).

## Requirements

- Day cards in the order of the week (household week start, as the plan delivers them).
- Today keeps its highlight („Heute · …“ and the border).

## Acceptance Criteria

- [x] Monday – Sunday on every screen width, today included in its place
- [x] Today still highlighted
- [x] Tests passing

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-10-10). `MealPlanPage.tsx` no longer sets `order: -1` on today's grid item, so the cards follow the order
of the plan's slots (Monday – Sunday). The highlight („Heute · …“, border) is unchanged. The page test now checks the
region order Montag … Sonntag and that today's item has no negative order; it fails without the fix. Validation:
lint, typecheck, 498 frontend tests. No new technical debt.

## Assumptions

- „Montag – Sonntag“ means the plan week; households with another week start see their own week order.

## Out of Scope

- Scrolling to today automatically.
