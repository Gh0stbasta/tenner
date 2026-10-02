# NOTIFICATION-008: Implement Weekly Summary

## Type

Backend Feature

---

## Priority

Low

---

## Phase

V2

---

## Goal

Send a weekly reflection message that supports long-term consistency:

```text
What did we accomplish this week?
What is slipping?
What is coming up next week?
```

---

# Background

The architecture vision asks: "How consistent am I over time?"
A weekly summary answers this without opening the analytics page.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
ANALYTICS-002
ANALYTICS-006
```

---

# Scope

## Content

```text
Your week in Tenner (21–27 Sep)

✅ 48 Tenners completed · 8 h 50 min
📈 +12% vs. previous week

Slipping
• Clean Exterior Window Sills (21 days overdue)

Next week: 39 Tenners · ~6 h
```

## Rules

- Household-level numbers plus the recipient's own share.
- Sent on the configured day and time.
- Reuse analytics service functions; no duplicated calculations.

---

# Testing Requirements

```text
Summary Rendering
Week Boundaries
Comparison Text (up/down/no data)
Next Week Projection
Deduplication Per Week
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Weekly summary job
Renderer
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

- Weekly summary sent once per week at configured time
- Numbers consistent with analytics endpoints
- Tests passing

---

# Definition of Done

- Users receive a weekly consistency reflection
- Feature deploys through GitHub Actions

---

# Out of Scope

- AI-written narrative (AI-007)
