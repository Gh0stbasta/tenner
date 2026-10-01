# NOTIFICATION-003: Implement Daily Digest

## Type

Backend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Send each user a short daily message answering:

```text
What is due today?
What is overdue?
How much time will it take?
```

---

# Background

The Today dashboard (TICKET-016) answers these questions inside the app.
The daily digest brings the same answer to the user proactively.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
TICKET-016
```

---

# Scope

## Content

```text
Good morning, Stefan ☀️

Today (3 Tenners · ~30 min)
• Vacuum Office
• Mobility Workout
• Clean Front Door

Overdue (1)
• Wash Car — 3 days

Open Tenner → <deep link>
```

## Rules

- Include Tenners assigned to the user plus unassigned/shared Tenners (HOUSEHOLD-002, when available).
- Skip sending if there is nothing due and nothing overdue (configurable later; default: skip).
- Maximum 10 items per section; show "+N more".
- Sent at the user's configured time in the user's timezone.
- Respect quiet hours.

## Reuse

Reuse the dashboard service logic from TICKET-016. Do not duplicate due/overdue rules.

---

# Testing Requirements

```text
Digest Content Rendering
Empty Day Skipped
Item Limits
Timezone-Correct Send Time
Quiet Hours
Deduplication Per Day
Assigned And Shared Tenners
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Daily digest job
Message renderer
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

- Digest sent once per day at configured time
- Content matches dashboard data
- Empty digests skipped
- Quiet hours respected
- Tests passing

---

# Definition of Done

- Users receive a daily overview without opening the app
- Feature deploys through GitHub Actions

---

# Out of Scope

- Interactive completion from the message (INTEGRATION-002)
- AI-generated text (AI-007)
