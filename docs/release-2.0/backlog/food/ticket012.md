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

- [ ] Calories, protein, carbohydrates and fat shown per dish and per day
- [ ] Clearly marked as an estimate
- [ ] Manual override possible
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- Values per adult portion; children's portions scale with their portion factor and are not shown separately.

---

# Out of Scope

- Vitamins, minerals, allergen labelling beyond the tags, nutrition goals.
