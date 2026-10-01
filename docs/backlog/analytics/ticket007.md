# ANALYTICS-007: Implement Household Balance Metrics

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

Make the distribution of household work between members transparent.

Users must be able to answer:

```text
Is the workload shared fairly?
Who carries which areas of responsibility?
```

---

# Background

Tenner is used by a household (currently Stefan and Julia). Making invisible work
visible is a key motivation for shared responsibility tracking.

The goal is transparency, not competition. The UI must avoid leaderboard framing.

---

# Dependencies

```text
ANALYTICS-001
ANALYTICS-003
```

---

# Scope

Implement:

```text
GET /analytics/balance
```

---

# Response

```json
{
  "success": true,
  "data": {
    "byUser": [
      { "userId": "STEFAN", "shareOfMinutes": 0.54, "shareOfAssignedLoad": 0.50 },
      { "userId": "JULIA",  "shareOfMinutes": 0.46, "shareOfAssignedLoad": 0.50 }
    ],
    "byCategory": [
      {
        "category": "HOUSEHOLD",
        "shares": { "STEFAN": 0.30, "JULIA": 0.70 }
      }
    ],
    "balanceIndex": 0.96
  }
}
```

---

# Definitions

```text
shareOfMinutes        user actualMinutes / total actualMinutes (completedBy)
shareOfAssignedLoad   user projected weekly minutes / total projected weekly minutes (assignedTo)
balanceIndex          1 - (max share - min share) over users, using shareOfMinutes
```

Projected weekly minutes reuse the definition from ANALYTICS-005.

Shares are `null` when totals are zero.

---

# Testing Requirements

```text
Even Distribution
Uneven Distribution
Category Shares
Zero Activity
Single User Household
Three Or More Users
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
GET /analytics/balance
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

- Balance endpoint implemented
- Shares by user and category computed
- Balance index computed as documented
- Works for any number of users
- Tests passing

---

# Definition of Done

- Household workload distribution is transparent
- Feature deploys through GitHub Actions

---

# Out of Scope

- Automatic rebalancing (AI-006)
- Leaderboards or competition features
