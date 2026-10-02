# FRONTEND-007: Implement Complete & Undo Completion Experience

## Type

Frontend Feature

---

## Priority

Critical

---

## Goal

Implement the complete user experience for completing and undoing Tenners.

This ticket connects the core business workflows to the UI and makes the application feel interactive and rewarding.

After completion of this ticket, users must be able to:

- Complete Tenners from anywhere in the application
- Undo accidental completions
- Immediately see dashboard updates
- Receive visual feedback
- Track recent completion activity

This ticket delivers the primary daily interaction pattern of Tenner.

---

# Background

The following capabilities already exist:

- Dashboard Page
- Tenners Page
- Complete Tenner API
- Undo Completion API
- Dashboard API

Users can currently see what needs to be done.

This ticket allows them to actually do it.

---

# Scope

Implement:

```text
Complete Tenner UX

Undo Completion UX

Recent Completion Activity
```

---

# Complete Action

Support completion from:

```text
Dashboard Page

Tenners Page
```

---

# Completion Button

Display:

```text
Complete
```

Icon:

```text
Check Circle
```

Recommended:

```text
CheckCircleIcon
```

---

# One-Click Completion

The default workflow should require only:

```text
One Click
```

Users should not be forced through a modal every time.

---

# Default Completion Values

Submit:

```text
completedBy = Current User

actualMinutes = estimatedMinutes
```

through:

```http
POST /tenners/{id}/complete
```

---

# Current User Handling

For MVP:

```text
Stefan

Julia
```

Current user selected through settings.

If no user selected:

```text
Stefan
```

as default.

---

# Optimistic Updates

Immediately update UI after completion.

Do not wait for dashboard refresh before showing feedback.

Use:

```text
TanStack Query Optimistic Updates
```

where appropriate.

---

# Success Behaviour

On successful completion:

```text
Remove Tenner From Due List

Refresh Dashboard

Refresh Tenners List

Show Success Snackbar

Add Entry To Recent Activity
```

---

# Success Notification

Example:

```text
✅ Vacuum Office completed.
```

---

# Undo Completion

Every completion should support:

```text
Undo
```

for a short period.

---

# Snackbar Action

Example:

```text
✅ Vacuum Office completed.

[UNDO]
```

Duration:

```text
10 seconds
```

---

# Undo Behaviour

Trigger:

```http
POST /tenners/{id}/undo-completion
```

---

# Successful Undo

On success:

```text
Return Tenner To Due List

Refresh Dashboard

Refresh Tenners

Show Success Message
```

Example:

```text
↩ Completion reverted.
```

---

# Recent Activity Widget

Create:

```text
Recent Activity
```

section.

Display:

```text
Recently Completed Tenners
```

---

# Information Displayed

```text
Title

Completed By

Completed Time
```

Example:

```text
Vacuum Office

Completed by Stefan

2 minutes ago
```

---

# Activity Limit

Display:

```text
Last 10 Completions
```

Maximum.

---

# Relative Time Formatting

Examples:

```text
Just Now

2 Minutes Ago

15 Minutes Ago

3 Hours Ago

Yesterday
```

---

# Dashboard Integration

Add:

```text
Recent Activity Widget
```

below primary dashboard content.

---

# Completion Animation

Add lightweight visual feedback.

Examples:

```text
Fade Out

Checkmark Animation

Success Highlight
```

Must remain subtle.

Avoid:

```text
Confetti

Heavy Animations

Gamification Effects
```

for MVP.

---

# Keyboard Support

Support:

```text
Space

Enter
```

for completion actions.

---

# Mobile Experience

Completion must be thumb-friendly.

Requirements:

```text
Large Touch Targets

Visible Actions

Fast Feedback
```

---

# Error Handling

Examples:

```text
Unable to complete Tenner.
```

```text
Unable to undo completion.
```

Provide retry options where practical.

---

# Components

Create:

```text
features/completions/

├── CompleteTennerButton
├── UndoCompletionAction
├── RecentActivityWidget
├── ActivityCard
├── CompletionSnackbar
└── CompletionTimeline
```

---

# Hooks

Create:

```text
useCompleteTenner()

useUndoCompletion()

useRecentActivity()
```

Responsibilities:

```text
API Calls

Mutations

Query Invalidation

Optimistic Updates
```

---

# State Management

Use:

```text
TanStack Query
```

for:

```text
Completion Mutations

Undo Mutations

Recent Activity Data
```

---

# Accessibility

Requirements:

```text
Keyboard Navigation

Screen Reader Labels

Accessible Buttons

Accessible Notifications
```

---

# Testing Requirements

Create tests for:

```text
Successful Completion

Successful Undo

Undo From Snackbar

Dashboard Refresh

Tenner List Refresh

Optimistic Updates

Completion Failure

Undo Failure

Recent Activity Rendering

Activity Ordering

Accessibility

Mobile Rendering
```

Coverage:

```text
80%
```

minimum for new code.

---

# Deliverables

Create:

```text
Completion Components

Undo Components

Recent Activity Widget

Completion Hooks

Snackbar Actions
```

Update:

```text
Dashboard

Tenners Page

Tests

Documentation
```

---

# Validation

The following must succeed:

```bash
npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Tenners can be completed from Dashboard
- Tenners can be completed from Tenners Page
- Undo available after completion
- Undo works correctly
- Dashboard updates automatically
- Recent Activity displayed
- Mobile layout works
- Accessibility requirements met
- Tests passing

---

# Definition of Done

- Complete workflow usable from UI
- Undo workflow usable from UI
- Users receive immediate feedback
- Recent activity visible
- Core Tenner interaction complete
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Streaks
- Points
- Achievements
- Analytics
- Notifications
- Multi-User Presence
- Real-Time Updates

These capabilities may be added in future releases.

---

# Implementation Status

Done 2026-10-02.

- One-click "Erledigt" (`CompleteTennerButton`, check-circle icon, ≥ 44 px) on the dashboard (due today, overdue)
  and on the Tenners page; `completedBy` = current user, `actualMinutes` = estimated minutes.
- Optimistic update: the Tenner leaves "Heute fällig"/"Überfällig" immediately (subtle collapse), summary and
  workload groups are adjusted; rollback on error. Dashboard, lists and history are refreshed afterwards.
- Snackbar "✅ „Titel“ erledigt." with "Rückgängig" for 10 seconds → `POST /tenners/{id}/undo-completion`
  (`revertedBy` = current user) → "↩ Erledigung zurückgenommen.". Failures show an error snackbar with
  "Erneut versuchen"; retries reuse the same `Idempotency-Key`, so they cannot complete or undo twice.
- "Zuletzt erledigt" on the dashboard: `GET /history?limit=10`, title, "Erledigt von …", relative time
  (gerade eben, vor N Minuten/Stunden, gestern, vor N Tagen); deleted Tenners show "Gelöschter Tenner".
- Current user: "Ich bin" selector in the header (Stefan/Julia, default Stefan), stored in `localStorage`.
- Keyboard: Enter and Space trigger the buttons (native buttons); labels like "„Büro saugen“ erledigen".
- Tests: 26 new (optimistic update, undo, retries with the same key, current user, activity, relative time).
  Frontend: lint, 144 tests (~98.7% coverage), build; Chromium check with mocked API.
- Deviations and assumptions:
  - The ticket says the current user is selected "through settings"; the settings page is FRONTEND-008
    (block 6). Until then the selection sits in the header.
  - The completion workflow is a provider (`CompletionProvider`) instead of separate `useCompleteTenner`/
    `useUndoCompletion` hooks, because the card that starts a completion is removed optimistically and its
    hooks would unmount before the response arrives. `UndoCompletionAction`, `CompletionSnackbar` and
    `CompletionTimeline` are covered by the provider, the global snackbar and `RecentActivityWidget`/`ActivityCard`.
  - Undo is offered in the snackbar only. The backend always reverts the Tenner's latest completion, so an
    undo button on older activity entries would be misleading.
  - `react-transition-group` (already a dependency of MUI) is now a direct dependency for the collapse animation.

