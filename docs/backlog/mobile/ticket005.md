# MOBILE-005: Optimize Mobile Navigation and Touch Interaction

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

Make the most common mobile actions reachable with one thumb.

---

# Background

FRONTEND-001 provides a responsive layout, but desktop-oriented navigation
(header/drawer) is not ideal on phones.

---

# Dependencies

```text
FRONTEND-001
FRONTEND-007
```

---

# Scope

## Navigation

- Bottom navigation bar on small screens: Today | Tenners | Analytics | Settings.
- Floating action button for Quick Add.
- Safe-area insets for notched devices (standalone PWA).

## Gestures

- Swipe right on a dashboard item → complete (with undo snackbar).
- Swipe left → snooze menu (when SCHEDULING-003 exists).
- Every gesture has a visible button alternative (accessibility).

## Touch Targets

- Minimum 44×44 px.
- Pull-to-refresh on dashboard.

## Haptics

Optional `navigator.vibrate` short feedback on completion where supported.

---

# Testing Requirements

```text
Bottom Navigation On Small Screens Only
Swipe To Complete
Swipe Alternative Buttons
Safe Area Layout
Pull To Refresh
```

Coverage for new code: 80% minimum.

---

# Deliverables

```text
Mobile navigation
Swipe interactions
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

Manual test on one Android and one iOS device.

---

# Acceptance Criteria

- One-thumb navigation on phones
- Swipe actions with accessible alternatives
- Touch targets meet minimum size
- Tests passing

---

# Definition of Done

- Completing a Tenner on a phone takes one gesture

---

# Out of Scope

- Native app (FUTURE-007)
