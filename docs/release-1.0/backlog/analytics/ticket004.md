# ANALYTICS-004: Implement Category Metrics

## Type

Backend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Show how attention is distributed across life areas.

Users must be able to answer:

```text
Which areas of life am I neglecting?
```

This is one of the core questions in the architecture vision.

---

# Background

Tenners have a `category` (HOUSEHOLD, FITNESS, FAMILY, HOME, PERSONAL, FINANCE).

The architecture lists "Time Spent By Category" as a metric.

---

# Dependencies

```text
ANALYTICS-001
```

---

# Scope

Implement:

```text
GET /analytics/categories
```

---

# Response

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "category": "FITNESS",
        "activeTenners": 8,
        "completions": 40,
        "actualMinutes": 900,
        "shareOfMinutes": 0.38,
        "overdueNow": 1,
        "healthScore": 0.92
      }
    ]
  }
}
```

---

# Health Score

Per category:

```text
healthScore = 1 - (overdue active Tenners / active Tenners)
```

Categories without active Tenners return `healthScore: null`.

Keep the formula simple and documented. A more sophisticated score may follow
in ANALYTICS-008.

---

# Rules

- Category is taken from the Tenner's current category.
- All known categories are returned, including those without activity.
- Category list comes from a single source (constant today, HOUSEHOLD-ADMIN-002 later).

---

# Testing Requirements

```text
Category Aggregation
Share Of Minutes Sums To 1
Empty Categories
Health Score
Null Health Score
Category Changed After Completion
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/categories
Tests
docs/analytics.md update
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Category metrics endpoint implemented
- Share and health score computed as defined
- All categories returned
- Tests passing

---

# Definition of Done

- Neglected life areas are identifiable
- Feature deploys through GitHub Actions

---

# Out of Scope

- Custom categories (HOUSEHOLD-ADMIN-002)
- Historical category snapshots

---

# Implementation Status

Implemented 2026-10-05.

- [x] Category metrics endpoint: `GET /analytics/categories` (route in Terraform)
- [x] `shareOfMinutes` and `healthScore = 1 − overdue ÷ active` computed as defined (null without data)
- [x] All categories returned: the household category list (HOUSEHOLD-ADMIN-002, the single source), in display
  order, including archived ones and categories without activity
- [x] Tests passing: backend 718; lint and build clean
- [ ] Deploys through GitHub Actions: one new API route; verified after merge

Decisions and assumptions:

- Categories are the managed household categories (HOUSEHOLD-ADMIN-002 now exists), each with its display `name`.
- The Tenner's current category counts ("Category Changed After Completion" test); completions of deleted Tenners
  are left out, so the shares of all categories sum to 1.
- Overdue excludes paused Tenners, as in the summary.
