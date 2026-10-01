# AI-007: Implement Weekly AI Insights

## Type

Backend Feature

---

## Priority

Low

---

## Phase

Long-Term

---

## Goal

Generate a short, personal, encouraging weekly narrative based on analytics:

```text
"Great week: you kept every fitness Tenner on schedule. Home maintenance is slipping —
the window sills have been waiting 3 weeks. 15 minutes on Saturday would clear it."
```

---

# Background

The weekly summary (NOTIFICATION-008) contains numbers. A narrative highlights what matters.

---

# Dependencies

```text
AI-001
NOTIFICATION-008
ANALYTICS-002, 006, 008
```

---

# Scope

- Input: aggregated analytics only (counts, scores, top neglected titles) — no raw history, no notes.
- Output schema: `{ headline, highlights[≤3], suggestion }`, max 600 characters total.
- Generated once per user per week by the notifier; cached; included in weekly summary
  and shown on the analytics page.
- Fallback to the numeric summary when AI is disabled, over budget or output invalid.
- Tone guidelines in the prompt: supportive, no guilt, consistency over intensity.

---

# Testing Requirements

```text
Schema Validation
Length Limit
Fallback Paths
Only Aggregates Sent
Eval Fixtures (tone and accuracy checks)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Insights generator
Prompt + schema
Notification and analytics integration
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

- Weekly insights generated within budget
- Factually consistent with analytics
- Graceful fallback
- Tests passing

---

# Definition of Done

- Users receive meaningful, motivating weekly reflection

---

# Out of Scope

- Daily AI messages
