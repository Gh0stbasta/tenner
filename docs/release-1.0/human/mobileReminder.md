# FRONTEND-010: Mobile Reminder & Daily Tenner Notification System

## Goal

Users should receive a daily reminder on their mobile device showing exactly which Tenner is due today.

The notification should replace the manual Google Calendar workflow currently used in the household.

---

# Background

The current household workflow uses:

- Dedicated Google Calendar
- Recurring events
- Push notifications
- Manual rescheduling

Tenner should become the single source of truth.

---

# Desired User Experience

Example notification:

🏠 Tenner

Today:
• Small bathroom + mirrors

Estimated effort: 10 minutes

---

# Notification Rules

## Daily Tenners

Send notification every morning.

Default:

08:00

Configurable in Settings.

---

## Overdue Tenners

Remind again in the evening.

Default:

18:00

---

## Snooze

Support:

- 1 hour
- Tonight
- Tomorrow

---

## Action Buttons

Notification actions:

✅ Done

⏰ Snooze

📱 Open Tenner

---

# Platforms

Implement for:

- PWA Push Notifications
- Android
- iOS capable architecture

---

# Acceptance Criteria

- Daily tasks arrive as push notifications
- Overdue notifications supported
- Action buttons work
- Reminder times configurable

``
