# AI-005: Implement Smart Scheduling Suggestions

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

Suggest due-date adjustments that smooth the household's daily load and fit
real availability.

```text
"Saturday has 95 min of Tenners, Tuesday has 10 — move 'Clean windows' to Tuesday?"
```

---

# Background

The architecture lists Smart Scheduling ("prefer weekends, avoid workdays, family balance").
Rule-based preferences exist in SCHEDULING-007. This ticket proposes optimizations across
all Tenners.

Load balancing is primarily an optimization problem; a deterministic algorithm is
more reliable and cheaper than an LLM for it. The LLM is used only to explain suggestions.

---

# Dependencies

```text
SCHEDULING-003
SCHEDULING-007
UX-006
INTEGRATION-007 (optional busy-day data)
AI-001
```

---

# Scope

## Algorithm (deterministic)

- Horizon: next 14 days.
- Constraint: move Tenners at most ±3 days (or within snooze limits), respect day preferences and weekdays.
- Objective: minimize variance of daily estimated minutes, weighted by busy-day data if available.
- Greedy heuristic is sufficient; no solver dependency.

## AI Explanation

Optional short natural-language explanation per suggestion (AI-001 guardrails).
Feature works without AI (plain explanation templates).

## Endpoint

```text
GET  /scheduling/suggestions
POST /scheduling/suggestions/apply   { suggestionIds: [...] }
```

Applying uses the snooze mechanism (auditable).

## Frontend

Calendar view (UX-006) shows suggestions; user applies individually or all.

---

# Testing Requirements

```text
Variance Reduced
Constraints Respected
No Suggestions When Balanced
Apply Uses Snooze
Works Without AI
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Balancing algorithm
Suggestions endpoints
Calendar integration
Optional AI explanations
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

- Suggestions reduce load peaks
- Constraints respected
- User approval required
- Works without AI
- Tests passing

---

# Definition of Done

- Household load is evenly distributed with minimal effort

---

# Out of Scope

- Automatic rescheduling without approval
