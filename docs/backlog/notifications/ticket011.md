# NOTIFICATION-011: Implement Push Notification Actions

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

From a push notification a member completes a Tenner („✅ Erledigt“) or postpones the reminder („⏰ Später“) without
opening the app; a tap opens the Tenner.

---

# Background

Owner ticket `docs/human/mobileReminder.md`: actions Done, Snooze (1 hour, tonight, tomorrow), Open. Owner decisions
2026-10-07: actions work directly through signed links; Android allows two buttons, so „Später“ uses a fixed choice
from the settings.

---

# Dependencies

```text
NOTIFICATION-009, NOTIFICATION-010
TICKET-013 (completion with Idempotency-Key)
```

---

# Scope

- Action tokens (`backend/src/push/action-token.ts`): HMAC-SHA256, 24 hours, one member, Tenner, cycle (`nextDue`)
  and action; secret `/tenner/prod/push/action-secret` (notifier signs, API verifies).
- Public `POST /push-actions` (no JWT): „Erledigt“ completes exactly the token's cycle (`expectedNextDue`, 409
  TENNER_CYCLE_CHANGED → „War schon erledigt“), „Später“ stores a snooze; the member must still be active.
- Preference `pushSnooze`: `1H` (default), `EVENING` (evening reminder time; in an hour if it has passed),
  `TOMORROW` (digest time tomorrow). Settings select shown when push is connected.
- Notifier: buttons on every per-Tenner notification; job `SNOOZED_REMINDER` re-sends snoozed Tenners still in the
  same cycle (push only, outside quiet hours) and removes delivered or stale snoozes.
- Service worker: buttons, POST of the token, confirmation notification, fallback to opening the Tenner.

---

# Acceptance Criteria

- [x] Action buttons work: „Erledigt“ completes, „Später“ re-sends at the chosen time, tap opens the Tenner
- [x] Tokens: tampering, other secrets, expiry and garbage are rejected (401); inactive members 403
- [x] A completed or skipped cycle is never completed twice by an old notification
- [x] Snoozed reminders respect quiet hours and are dropped when the Tenner is done
- [x] Tokens are never logged
- [x] Tests passing: backend 924, frontend 407 (incl. the service worker), Terraform 76; lint, typecheck, build clean
- [ ] Buttons used on a real Android phone — owner, after setup

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (README push setup and secrets, backend API table, security.md)
- [x] Technical debt documented (none new; bundle size note below)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- **Risk accepted by the owner:** anyone who sees the notification (lock screen) can tap its buttons. The token
  only covers that Tenner cycle for 24 hours; there is no other access.
- The completion is recorded as done by the member the notification was for (completedBy = recordedBy).
- iOS shows no notification buttons; a tap opens the Tenner (iOS-capable architecture, as the ticket asks).
- The API bundle grows from 1.3 MB to 1.5 MB (SSM client for the secret); the cold start rises slightly.
- The environment variable is called `PUSH_ACTION_HMAC_PARAMETER`, because the existing Terraform rule forbids
  "secret" in Lambda variable names. It holds the parameter name, never the value.

---

# Out of Scope

- A choice between the three snooze options in the notification itself (Android allows two buttons).

---

# Implementation Status

Done (2026-10-07). Owner setup: README → Notifications → Browser push (two Parameter Store values).
