# MOBILE-006: Implement Push Notification Subscription

## Type

Frontend Feature

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Allow users to enable push notifications on their device and handle incoming pushes
in the service worker.

---

# Background

The server side (VAPID, sending) is implemented in NOTIFICATION-007.
iOS supports Web Push only for PWAs added to the home screen (iOS 16.4+).

---

# Dependencies

```text
MOBILE-001
MOBILE-002
NOTIFICATION-007
```

---

# Scope

## Subscription Flow

- Settings → Notifications → "Enable on this device".
- Ask permission only after this explicit user action (never on page load).
- Subscribe with the VAPID public key, send subscription to the backend.
- Show per-device status; "Disable on this device" unsubscribes and deletes server-side.

## Service Worker

- `push` handler shows notification (title, body, icon, badge).
- `notificationclick` focuses an open window or opens the deep link.

## Platform Handling

- iOS outside standalone mode: explain that installation is required.
- Permission denied: explain how to re-enable in OS settings.

---

# Testing Requirements

```text
Permission Requested Only On Action
Subscription Sent To Backend
Unsubscribe Removes Server Record
Push Handler Shows Notification
Click Opens Deep Link
iOS Non-Standalone Guidance
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Subscription UI
Service worker handlers
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

- Users can enable/disable push per device
- Notifications displayed and clickable
- Platform limitations explained
- Tests passing

---

# Definition of Done

- Installed PWA receives push reminders

---

# Out of Scope

- Notification action buttons
