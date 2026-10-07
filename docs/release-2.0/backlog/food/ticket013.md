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

- Family cost per dish = Σ ingredient quantity per adult portion × Σ portion factors × price per unit;
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

- [ ] Each dish shows a family cost tier and range
- [ ] Week total visible
- [ ] Prices and tiers adjustable
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

- Prices are self-maintained estimates; no live supermarket data.

---

# Out of Scope

- Budget limits as planning rules, receipt scanning.
