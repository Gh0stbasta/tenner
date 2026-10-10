# FOOD-013: Cost Estimate

## Type

Full-Stack Feature

---

## Priority

Medium

---

## Phase

2.0 Extended

---

## Goal

Every dish shows what it roughly costs for the whole family, and the week shows a total, so cheap and expensive
weeks become visible.

---

# Background

Owner breakdown FOOD-013 with family price bands „4–6 EUR · 8–10 EUR · 12–15 EUR“. Prices per ingredient exist in
the reference catalog (FOOD-021).

---

# Dependencies

```text
FOOD-021
FOOD-004 (portion factors)
FOOD-002
```

---

# Scope

## Calculation

- Family cost per dish = Σ ingredient quantity per adult portion × Σ portion factors × price per unit (dish view:
  whole family; plan and week total: the eaters present at each meal, e.g. two adults on weekday lunches);
  pantry ingredients count with a small flat amount.
- `costOverride` (EUR) on the dish replaces the calculation.
- Tier from household thresholds (profile, defaults from the owner): `€` up to 6 EUR, `€€` up to 10 EUR, `€€€`
  above; shown as tier and range („ca. 8–10 €“).
- Week total and average per meal on the plan page.
- Ingredient prices editable (FOOD-010 inline, Settings → Essen → „Preise“) for when supermarket prices change.

---

# Testing Requirements

```text
Calculation with portions and units
Override wins
Tier thresholds and boundaries
Week total
Price edit changes results
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Cost calculation and tiers
Display on dish, plan and week
Price editing
Tests
```

---

# Validation

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm run build && npm test
```

---

# Acceptance Criteria

- [x] Each dish shows a family cost tier and range
- [x] Week total visible
- [x] Prices and tiers adjustable
- [x] Tests passing

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- Prices are self-maintained estimates; no live supermarket data.
- Optional ingredients are left out (like nutrition); pantry ingredients count 0.10 € each per meal.
- Range: a 2-euro band around the family cost („ca. 8–10 €“), below 2 € „unter 2 €“. Boundaries belong to the lower
  tier (exactly 6 € is €).
- The dish list prices the whole family (sum of all portion factors; one adult portion while no eaters exist); plan
  meals are priced for their eaters (e.g. two adults on weekday lunches). An override is the whole family's amount and
  is scaled to the eaters present.
- Prices are edited in Settings → Essen → „Preise“; the editor has no inline price field (the dish editor is about
  dishes, and one place for prices is easier to find). `costOverride` stays an API field.

---

# Out of Scope

- Budget limits as planning rules, receipt scanning.

---

# Implementation Status

Done (2026-10-10).

- Backend: `src/meals/cost.ts` (`estimateCost`, `mealCost`); `deriveDish` adds `cost` to every dish response,
  `toDishSummary` passes it on; plan slots get `cost` for their eaters, the plan a week `cost { total, perMeal, meals,
  complete }`; profile `costTiers` (default 6 / 10 EUR, validated).
- Frontend: tier and range on dish cards, week total and average in the plan header, tier fields in the rules dialog,
  `IngredientPricesDialog` (Settings → Essen → „Preise“) with `useUpdateIngredientPrice`.
- Tests: `backend/tests/meals-cost.test.ts` (units, pieces, pantry, optional, override and scaling, missing
  ingredients, price change, plan meal and week totals, tiers); frontend `format.test.ts`, dish list, plan page,
  rules dialog and prices dialog.
- Validation: backend lint, typecheck, 1,112 tests; frontend lint, typecheck, build, 488 tests.
- Technical debt: TD-046 (number fields in the rules dialog clamp while typing).

