# ANALYTICS-003: Implement User Metrics

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

Provide per-household-member metrics.

Users must be able to answer:

```text
How many Tenners did each person complete?
How much time did each person invest?
How many of each person's assigned Tenners are overdue?
```

---

# Background

The architecture lists "Time Spent By User" as a dashboard metric.

Tenners have an `assignedTo` user, completions have a `completedBy` user.
These can differ: a Tenner assigned to Julia may be completed by Stefan.

---

# Dependencies

```text
ANALYTICS-001
```

---

# Scope

Implement:

```text
GET /analytics/users
```

---

# Response

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "STEFAN",
        "completions": 112,
        "actualMinutes": 1240,
        "assignedActive": 21,
        "assignedOverdue": 2,
        "completedForOthers": 9
      }
    ]
  }
}
```

---

# Definitions

```text
completions          Completions with completedBy = user in period
actualMinutes        Sum of actualMinutes for those completions
assignedActive       Active Tenners currently assigned to user
assignedOverdue      Active Tenners assigned to user with nextDue < today
completedForOthers   Completions by user where Tenner.assignedTo != user
```

The list of users must come from the central user source
(hardcoded constant today, HOUSEHOLD-ADMIN-001 later). Do not duplicate user lists.

---

# Testing Requirements

```text
Per-User Completions
Per-User Minutes
Assigned vs Completed Divergence
User Without Completions
Overdue Count
Deleted Tenners Excluded From Assigned Counts
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/users
Aggregation functions
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

- User metrics endpoint implemented
- All metrics computed as defined
- Users without activity included with zero values
- Single source of truth for users used
- Tests passing

---

# Definition of Done

- Per-user metrics available
- Feature deploys through GitHub Actions

---

# Out of Scope

- Fairness/balance scoring (ANALYTICS-007)
- User rankings or leaderboards (FUTURE-006)
