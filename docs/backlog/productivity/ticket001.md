# PRODUCTIVITY-001: Implement "I Have X Minutes" Suggestions

## Type

Full-Stack Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Answer the question from the architecture vision:

```text
What should I spend 20 minutes on today?
```

with a deterministic, rule-based suggestion list.

---

# Background

Tenner's core idea: "If something can be improved in 10 minutes, do a Tenner."

Users often have a short time window (waiting for dinner, 15 minutes before a call).
A ranked list of Tenners that fit the window removes decision friction.

AI-008 later adds a conversational assistant; this ticket provides the
deterministic engine that the AI can also use.

---

# Dependencies

```text
TICKET-016
FRONTEND-002
```

---

# Scope

## Endpoint

```text
GET /suggestions?minutes=20&userId=STEFAN
```

`minutes`: 5 – 240.

## Ranking

Candidate Tenners: active, not paused/snoozed, due within the next 7 days or overdue,
assigned to the user or shared.

Score:

```text
score = overdueWeight + dueTodayWeight + neglectWeight + importanceWeight
```

with centralized constants. Then greedily fill the time window by score using
`estimatedMinutes` (knapsack-like greedy, no optimization library).

## Response

```json
{
  "success": true,
  "data": {
    "minutes": 20,
    "plannedMinutes": 20,
    "items": [
      { "tennerId": "tenner-005", "title": "Clean Front Door", "estimatedMinutes": 10, "reason": "OVERDUE" },
      { "tennerId": "tenner-001", "title": "Vacuum Office", "estimatedMinutes": 10, "reason": "DUE_TODAY" }
    ]
  }
}
```

`reason`: `OVERDUE | DUE_TODAY | DUE_SOON | NEGLECTED`.

## Frontend

Dashboard button "I have … minutes" with chips: 10 / 20 / 30 / 60.
Shows the suggestion list with one-tap completion (reuse FRONTEND-007 mutation).

---

# Testing Requirements

```text
Fits Time Window
Overdue Prioritized
No Candidates
Single Large Tenner Exceeding Window Excluded
Paused And Snoozed Excluded
Minutes Validation
Deterministic Ordering
UI Chips And Completion
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Suggestions endpoint
Ranking module (pure functions)
Dashboard UI
Tests
Documentation
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

- Suggestions fit the requested window
- Ranking documented and deterministic
- Users can complete directly from suggestions
- Tests passing

---

# Definition of Done

- "What should I do now?" is answered in one tap
- Feature deploys through GitHub Actions

---

# Out of Scope

- Natural language questions (AI-008)
- Location- or energy-aware suggestions
