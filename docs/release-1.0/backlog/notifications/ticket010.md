# NOTIFICATION-010: Implement Per-Tenner Push Reminders

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

Each morning every Tenner due today arrives as its own push notification; in the evening, overdue Tenners are
reminded again. Both times are configurable.

---

# Background

Owner ticket `docs/human/mobileReminder.md` (2026-10-07): „Today: • Small bathroom + mirrors · Estimated effort:
10 minutes“, daily at 08:00, overdue again at 18:00, configurable in Settings. Owner decision 2026-10-07: one
notification per Tenner.

---

# Dependencies

```text
NOTIFICATION-009 (browser push), NOTIFICATION-003 (digest), NOTIFICATION-004 (overdue alerts)
```

---

# Scope

- Messages carry structured items (Tenner ID, title, estimate, overdue days, due date).
- Push channel: one notification per Tenner („🏠 Tenner“ / „Heute: <Titel>“ or „Überfällig seit N Tagen: <Titel>“
  / „Geschätzter Aufwand: N Minuten“), tagged per Tenner, opening the Tenner page; at most 8 per message plus a
  „+N weitere Tenner“ notification. Other channels (log, Alexa) are unchanged.
- Defaults: daily digest 08:00 (was 07:30), new evening time for overdue alerts `overdueAlerts.time`, default 18:00
  (was a fixed 17:00). Stored preferences without it read 18:00; older clients may omit it.
- Settings: „Uhrzeit (abends)“ for the overdue reminders.

---

# Acceptance Criteria

- [x] Daily Tenners arrive as push notifications (one per Tenner, morning time)
- [x] Overdue notifications in the evening at the member's time
- [x] Reminder times configurable (morning and evening)
- [x] Existing preferences keep working (evening default)
- [x] Tests passing: backend 904, frontend 400; lint, typecheck clean

---

# Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated (README, backend API table, architecture, Alexa README, runbook)
- [x] Technical debt documented (none new)
- [x] Acceptance criteria verified
- [x] Git commit created

---

# Assumptions

- The morning notification covers Tenners due today; overdue ones come in the evening (avoids doubles).
- Members who never changed their settings move from 07:30 to 08:00 and from 17:00 to 18:00 (owner's defaults).
- Cap of 8 per message keeps a long day readable; the rest are summarised.

---

# Out of Scope

- Action buttons and snooze (NOTIFICATION-011).

---

# Implementation Status

Done (2026-10-07).
