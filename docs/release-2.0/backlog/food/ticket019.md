# FOOD-019: Food Analytics

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

2.0 Extended

---

## Goal

A food section on the analytics page shows how the family eats: protein sources, vegetarian share, favorite dishes,
cost and variety over time.

---

# Background

Owner breakdown FOOD-019. The analytics page (ANALYTICS-009) and its on-the-fly aggregation pattern (TD-033) exist;
meal history comes from FOOD-023.

---

# Dependencies

```text
FOOD-023
FOOD-013
ANALYTICS-009
```

---

# Scope

## Endpoint

```text
GET /meals/analytics?period=4w|12w|1y
```

Computed on the fly from stored plans (cooked and planned-in-the-past slots):

| Metric | Definition |
|---|---|
| Protein sources | count per protein tag, incl. „ohne“ |
| Vegetarian share | share of meals that are vegetarian (without variants) |
| Favorite dishes | top 10 by cooked count and 👍 |
| Rarely eaten | active dishes not eaten in the period |
| Cost | estimated cost per week, average per meal |
| Variety | distinct dishes / meals; repeats per dish |
| Plan adherence | share of meals cooked as planned vs replaced, skipped, other |

## UI

- Analytics page tab „Essen“: protein bar chart, vegetarian share stat tile, favorites list, cost per week line
  chart, variety and adherence tiles; existing chart components and colors.

---

# Testing Requirements

```text
Each metric on fixed fixture plans
Periods and household timezone
Empty history → friendly empty state
UI renders with fixtures
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Analytics endpoint
Analytics tab „Essen“
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

- [ ] Protein sources, vegetarian share, favorites and cost shown
- [ ] Variety and plan adherence visible
- [ ] Periods 4 weeks, 12 weeks, 1 year
- [ ] Tests passing

---

# Definition of Done

- [ ] Implementation completed
- [ ] Tests completed
- [ ] Documentation updated (docs/analytics.md)
- [ ] Technical debt documented
- [ ] Acceptance criteria verified
- [ ] Git commit created

---

# Assumptions

- At most 52 plans per year: on-the-fly aggregation is enough.

---

# Out of Scope

- Nutrition analytics over time, comparisons between households.
