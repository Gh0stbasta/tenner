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
