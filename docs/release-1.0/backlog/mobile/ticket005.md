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

---

# Implementation Status

Implemented 2026-10-05.

- [x] One-thumb navigation on phones: bottom navigation (Dashboard | Tenner | Auswertung | Einstellungen) below `md`
  replaces the drawer and its menu button; floating Quick Add button (focuses the Quick Add input, or opens the
  dashboard with it); safe-area insets with `viewport-fit=cover`
- [x] Swipe actions with accessible alternatives: right completes, left opens the snooze menu on due/overdue
  dashboard cards; the "Erledigt" and "Verschieben" buttons remain; vertical scrolling is not hijacked
- [x] Touch targets ≥ 44 × 44 px on touch screens (theme overrides under `(pointer: coarse)`)
- [x] Pull-to-refresh on the dashboard; short haptic feedback on completion where supported
- [x] Tests passing: frontend 347 (bottom navigation, Quick Add button, swipe right/left, ignored short and vertical
  gestures, button alternatives, drag hint, pull to refresh, touch target sizes); new code ~96 % lines; lint and
  build clean
- [x] Checked in Chromium with touch emulation (390 px): a real touch swipe completes the Tenner; bottom navigation
  and Quick Add button appear only below `md`
- [ ] Manual test on one Android and one iOS device: after deploy (needs the owner's phones)

Decisions and assumptions:

- "Small screens" = below `md` (900 px), the same breakpoint as the side navigation, so every width has exactly one
  navigation; the temporary drawer was removed.
- Gestures use touch events (only touch screens swipe); the threshold is 80 px.
- Swipes are offered on the dashboard cards only (where completing happens); lists and detail pages keep buttons.
