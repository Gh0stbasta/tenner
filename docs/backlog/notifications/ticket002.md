# NOTIFICATION-002: Implement Reminder Preferences

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

Allow each household member to control which notifications they receive,
through which channel and at what time.

---

# Background

Notifications without control quickly become noise. Respecting "Simplicity First",
defaults must be sensible so that most users never need to change them.

Settings are currently stored in Local Storage (FRONTEND-008). Notification
preferences must be stored server-side because the notifier Lambda needs them.

---

# Dependencies

```text
NOTIFICATION-001
FRONTEND-008
HOUSEHOLD-ADMIN-001 (user records) — if not yet available, key preferences by the existing user constant
```

---

# Scope

## Backend

Implement:

```text
GET /users/{userId}/notification-preferences
PUT /users/{userId}/notification-preferences
```

Storage: an item per user in the users/settings table (HOUSEHOLD-ADMIN-001) or,
if that ticket is not done yet, in a minimal `tenner-preferences` table
keyed by `tenantId` + `userId`. Document the choice.

## Preference Model

```json
{
  "timezone": "Europe/Berlin",
  "dailyDigest": { "enabled": true, "time": "07:30", "channels": ["TELEGRAM"] },
  "overdueAlerts": { "enabled": true, "minDaysOverdue": 2, "channels": ["TELEGRAM"] },
  "weeklySummary": { "enabled": false, "dayOfWeek": "SUNDAY", "time": "18:00", "channels": ["EMAIL"] },
  "quietHours": { "start": "21:30", "end": "07:00" },
  "channels": {
    "EMAIL": { "address": "user@example.com", "verified": false },
    "TELEGRAM": { "chatId": null, "linked": false },
    "WEB_PUSH": { "subscriptions": 0 }
  }
}
```

## Validation

```text
time           HH:mm, 15-minute steps (matches notifier schedule)
minDaysOverdue 0 - 30
channels       only channels configured for the user
timezone       valid IANA timezone
```

Channel addresses are personal data: they must never be logged.

---

## Frontend

Add a section "Notifications" to `/settings`:

```text
Daily digest   [toggle] [time] [channels]
Overdue alerts [toggle] [min days] [channels]
Weekly summary [toggle] [day] [time] [channels]
Quiet hours    [start] [end]
```

Channel connection flows are implemented in the channel tickets; this ticket shows
connection status only.

---

# Testing Requirements

```text
Default Preferences
Update Preferences
Invalid Time
Invalid Timezone
Unconfigured Channel Rejected
Quiet Hours Overnight Range
Frontend Form Validation
Frontend Save And Reload
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Preferences API
Storage (Terraform if new table)
Settings section in frontend
Tests
Documentation
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Preferences readable and writable per user
- Sensible defaults applied
- Input validated
- Settings UI section implemented
- Personal data not logged
- Tests passing

---

# Definition of Done

- Users control their notifications
- Notifier can read preferences
- Feature deploys through GitHub Actions

---

# Out of Scope

- Channel linking flows (NOTIFICATION-005, 006, 007)
- Per-Tenner notification overrides

---

# Implementation Status

Implemented 2026-10-06.

- [x] `GET`/`PUT /users/{userId}/notification-preferences` (routes in Terraform); only the member themselves (403),
  unknown member 404
- [x] Storage: map `notificationPreferences` (+ version, optimistic locking) on the existing household item
  (HOUSEHOLD-ADMIN-001 exists, so no new table); `NotificationPreferencesService.preferencesOf` for the notifier
- [x] Defaults: digest 07:30 on, overdue alerts from 2 days on, weekly summary off (Sunday 18:00), quiet hours
  21:30–07:00, no channels, household timezone
- [x] Validation: HH:mm in 15-minute steps, `minDaysOverdue` 0–30, IANA timezone or null, weekday MON–SUN, known
  and distinct channels, only connected channels (`ConnectedChannels`, empty until a channel ticket connects one),
  unknown fields rejected
- [x] Settings → "Benachrichtigungen": toggles, times, days, weekday, quiet hours, channel checkboxes for connected
  channels only, connection hint, effective timezone; saved on every change
- [x] Personal data not logged (log: user and enabled flags only)
- [x] Tests passing: backend 813 (+18), frontend 356 (+5: defaults and save/reload, 15-minute times, invalid days,
  connected channels only, quiet hours off, load error), Terraform 64; lint, format and builds clean

Decisions and assumptions:

- Preferences are personal: a member cannot change another member's preferences.
- The model follows the ticket except channel addresses (`channels.EMAIL.address` etc.): they belong to the channel
  tickets; the response shows connection status only.
- Weekday values use the existing `MON`–`SUN` enum instead of `SUNDAY`.
- The settings heading "Für mich (nur auf diesem Gerät)" became "Für mich", because notifications are stored on the
  server.
