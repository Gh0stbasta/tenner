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

---

# Implementation Status

Implemented 2026-10-06.

- [x] Job `dailyDigestJob` (`backend/src/notifications/daily-digest.ts`) registered in the notifier
- [x] Content as specified, in German: greeting by local time with name, „Heute (3 Tenner · ~30 Min.)“ list,
  „Überfällig (1)“ with days, „Tenner öffnen → <APP_URL>“; subject with counts and minutes; structured facts for
  channels without free text (Alexa, ALEXA-008)
- [x] Own + shared Tenners from the dashboard read model (`DashboardService`, no duplicated due/overdue/paused rules)
- [x] Empty days skipped; at most 10 items per section with „+N weitere“
- [x] Sent at the member's time in their timezone (own or household), not in quiet hours; once per day (dedup key)
- [x] Terraform: notifier reads the Tenner table (GetItem/Query incl. indexes), `APP_URL` = CloudFront URL
- [x] Tests passing: backend 821 (+8: rendering, empty day, limits, greeting, timezone-correct time, quiet hours,
  own + shared, dedup per day), Terraform 65 (+1); lint and build clean

Decisions and assumptions:

- Delivered to the log channel plus the member's connected channels; with no channel connected yet, the digest is
  only logged.
- The dedup date is the household's local date (a member with another timezone could in theory get the digest
  twice around midnight; not relevant for one household in one timezone).
