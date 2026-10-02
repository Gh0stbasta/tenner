# AI-006: Implement Workload Balancing Recommendations

## Type

Full-Stack Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Recommend reassignments that balance workload between household members,
based on Household Balance metrics (ANALYTICS-007).

---

# Background

Balance metrics make imbalance visible; this ticket proposes concrete changes.
As with AI-005, the core is deterministic; AI is used for phrasing only.

---

# Dependencies

```text
ANALYTICS-007
HOUSEHOLD-001
AI-001
```

---

# Scope

## Recommendation Logic

- Compute projected weekly minutes per member (ANALYTICS-005 definition).
- If imbalance > configurable threshold (e.g. 60/40), propose up to 3 reassignments or
  conversion to rotating assignment that move shares closest to the target split.
- Target split configurable (default equal); households may define e.g. 60/40 deliberately.

## Endpoint

```text
GET  /household/balance/recommendations
POST /household/balance/recommendations/apply
```

## Tone

Neutral, non-judgmental wording; no blame. Reviewed text templates; AI phrasing optional.

---

# Testing Requirements

```text
No Recommendation When Balanced
Recommendations Improve Balance
Respects Target Split
Rotation Proposal
Apply Reassigns
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Recommendation logic
Endpoints
UI on analytics balance section
Tests
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

- Concrete, explainable recommendations
- User approval required
- Configurable target split
- Tests passing

---

# Definition of Done

- Workload fairness is actionable

---

# Out of Scope

- Automatic reassignment
