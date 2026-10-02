# AI-004: Implement Missed Responsibility Detection

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

Identify important responsibilities a household is likely missing entirely,
typically low-frequency, high-consequence tasks.

```text
Smoke detector test (yearly)
Replace water filter (every 6 months)
Check tyre pressure (monthly)
Review insurance contracts (yearly)
```

---

# Background

Suggested Tenners (AI-003) extend existing areas. Missed responsibilities focus on
consequential gaps (safety, finance, maintenance) that are easy to forget completely.

---

# Dependencies

```text
AI-001
AI-003
HOUSEHOLD-ADMIN-003 (optional household profile)
```

---

# Scope

## Household Profile (opt-in)

Optional simple profile to improve relevance:

```text
Home type: apartment | house
Garden: yes/no
Car: yes/no
Pets: none | dog | cat | other
Children: yes/no
```

Stored in household settings; sent to the model only when the feature is used.

## Detection

- Curated checklist (static, versioned JSON, ~100 items with category, importance, frequency)
  matched against existing Tenners by the model (semantic matching).
- Output: missing items with importance and a short reason.
- The curated list keeps output grounded; the model does matching, not invention.

## Frontend

"Health check" card in analytics or settings: "3 important responsibilities may be missing".

---

# Testing Requirements

```text
Curated List Schema
Matching Output Validation
Profile Filtering (no garden → no lawn items)
Feature Flag Off
Eval Fixtures
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Household profile fields
Curated checklist
Detection endpoint
UI card
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

- Missing high-importance responsibilities identified
- Grounded in curated checklist
- Profile is optional and opt-in
- Tests passing

---

# Definition of Done

- Important but forgotten responsibilities surface

---

# Out of Scope

- Region-specific legal obligations
