# NOTIFICATION-004: Implement Overdue Alerts

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

Alert a user when one of their Tenners becomes significantly overdue.

---

# Background

The daily digest lists overdue Tenners, but users who disable the digest or ignore
it should still be informed when an important responsibility slips.

---

# Dependencies

```text
NOTIFICATION-001
NOTIFICATION-002
```

---

# Scope

## Trigger

A Tenner triggers an alert when:

```text
today - nextDue >= user.minDaysOverdue
```

## Frequency Control

- At most one alert per Tenner per overdue cycle (until it is completed or snoozed).
- At most one alert message per user per day; multiple Tenners are bundled.
- Escalation: one reminder alert after `2 × frequencyDays` overdue, then none.

Dedup key extension:

```text
<tenantId>#<userId>#OVERDUE#<tennerId>#<nextDue>
```

## Recipient

The assigned user. If the Tenner is shared/unassigned, all members.

---

# Testing Requirements

```text
Threshold Reached
Below Threshold
Bundling Multiple Tenners
Once Per Cycle
Escalation Reminder
Completion Resets Cycle
Snoozed Tenner Ignored (SCHEDULING-003)
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Overdue alert job
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

- Alerts sent when threshold reached
- No repeated alerts per cycle beyond one escalation
- Alerts bundled per user per day
- Tests passing

---

# Definition of Done

- Significant overdue Tenners are actively surfaced
- Feature deploys through GitHub Actions

---

# Out of Scope

- Escalating to other household members automatically
- SMS or phone calls

---

# Implementation Status

Implemented 2026-10-06.

- [x] Job `overdueAlertJob` (`backend/src/notifications/overdue-alerts.ts`) registered in the notifier
- [x] Trigger `overdueDays ≥ minDaysOverdue` (at least 1) for the member's own and shared Tenners from the dashboard
  read model (snoozed and paused Tenners are not overdue there)
- [x] Once per overdue cycle: marker `<tenantId>#<userId>#OVERDUE#<tennerId>#<nextDue>` written after delivery;
  completion/snooze changes `nextDue` and starts a new cycle
- [x] One escalation reminder after `2 × frequencyDays` (marker `…#ESCALATION`), then none
- [x] Bundled: one message per member per day (daily dedup key), „(Erinnerung)“ marks escalations
- [x] Delivery log: `has` (key-only read) and `mark` (UpdateItem, same IAM as before)
- [x] Tests passing: backend 831 (+10: threshold, below threshold, bundling, once per cycle, escalation,
  completion resets, snoozed ignored, timing/quiet hours/disabled, rendering, marker storage); lint and build clean

Decisions and assumptions:

- Alerts are checked once per day at 17:00 local time (`ALERT_TIME`); the ticket names no time, and the morning
  is covered by the daily digest.
- Recipients: the assigned member; shared Tenners alert every member (each gets them through their own dashboard
  view).
- `frequencyDays` comes from one Tenner list query per run and member (household volume).
