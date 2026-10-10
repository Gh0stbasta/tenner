# FOOD-012: Nutrition Estimate

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

Every dish and every day shows a rough nutrition estimate — calories, protein, carbohydrates, fat — so the family
sees whether lunches are really light.

---

# Background

Owner breakdown FOOD-012: „Grobe Angabe … Nicht wissenschaftlich exakt.“ Ingredient values per 100 g exist in the
reference catalog (FOOD-021).

---

# Dependencies

```text
FOOD-021
FOOD-002
```

---

# Scope

## Calculation (`backend/src/meals/nutrition.ts`)

- Per adult portion: Σ ingredient quantity (converted to g/ml) × value per 100 / 100; optional ingredients excluded.
- `nutritionOverride` on the dish replaces the calculation.
- Per day: lunch + dinner per adult portion.
- Rounded: kcal to 10, macros to whole grams; flagged `estimated: true`.
- Returned with dishes and plans (no separate storage).

## UI

- Dish card and editor: „ca. 520 kcal · 24 g Eiweiß · 60 g KH · 18 g Fett (pro Erwachsenenportion)“.
- Plan page: day total in the day header; weekday lunches above a configurable threshold (default 600 kcal)
  get a soft hint (supports R9).
- Info text: „Grobe Schätzung, keine Ernährungsberatung.“

---

# Testing Requirements

```text
Calculation with unit conversion
Optional ingredients excluded
Override wins
Rounding
Missing ingredient values → partial result flagged
UI display and hint threshold
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Nutrition calculation
Display on dish, editor and plan
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

- [x] Calories, protein, carbohydrates and fat shown per dish and per day
- [x] Clearly marked as an estimate
- [x] Manual override possible
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

- Values per adult portion; children's portions scale with their portion factor and are not shown separately.
- The day header shows kcal only (the full line per dish is on the dish cards and in the editor) to keep the plan
  readable on the phone.
- The threshold is a profile setting `lightLunchMaxKcal` (rules dialog „Leichtes Mittagessen bis (kcal)“), shown only
  while „Mittags unter der Woche leicht“ is on. The hint is computed in the app; the planner still uses `lightness`
  (R9) and does not plan by calories.
- An override is per adult portion and allows up to 3000 kcal (the per-100 g limit of 1000 does not fit a portion).
- The editor shows the server's estimate as of the last save, not a live recalculation (no second copy of the
  calculation in the app, see TD-044).

---

# Out of Scope

- Vitamins, minerals, allergen labelling beyond the tags, nutrition goals.

---

# Implementation Status

Done (2026-10-10).

- Backend: `src/meals/nutrition.ts` (`estimateNutrition`, `roundNutrition`, `sumNutrition`); `deriveDish` adds
  `nutrition` to every dish response, `toDishSummary` passes it into plans; profile rule `lightLunchMaxKcal` (default
  600, older profiles get the default); `nutritionOverride` limits per portion.
- Frontend: nutrition line on dish cards and in the editor with the disclaimer, „Nährwerte selbst eintragen“ (four
  fields, validated), day totals in the plan's day headers, soft hint „ca. 750 kcal: für mittags unter der Woche eher
  schwer“, threshold in the rules dialog.
- Tests: `backend/tests/meals-nutrition.test.ts` (conversion, optional, override, rounding, partial result, summary,
  threshold, override limits); frontend `format.test.ts`, plan page, dish list, editor and `dishes.test.ts`.
- Validation: backend lint, typecheck, 1,106 tests; frontend lint, typecheck, build, 480 tests.
- Technical debt: none new. The catalog values are rough by design (FOOD-021).

