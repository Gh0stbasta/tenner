# FRONTEND-008: Implement Settings & User Preferences

## Type

Frontend Feature

---

## Priority

High

---

## Goal

Implement the Settings experience for Tenner.

This feature allows users to configure application preferences and household defaults.

The objective is to remove hardcoded assumptions from the UI and provide a foundation for personalization.

After completion of this ticket, users must be able to:

- Select the active household user
- Configure Quick Add defaults
- Configure dashboard preferences
- Configure application preferences
- Persist settings locally

---

# Background

The current application assumes:

```text
Current User = Stefan

Default Category = HOUSEHOLD

Default Duration = 10 Minutes

Default Frequency = 14 Days
```

These defaults work initially but should become configurable.

This ticket introduces user preferences.

---

# Scope

Implement:

```text
/settings
```

---

# Settings Sections

Create:

```text
Profile

Quick Add Defaults

Dashboard Preferences

Application Preferences
```

---

# Profile Section

Configure:

```text
Current User
```

Purpose:

```text
Determines who is completing Tenners by default.
```

---

## Current User

Type:

```text
Dropdown
```

Options:

```text
Stefan

Julia
```

Default:

```text
Stefan
```

---

# Quick Add Defaults

Configure default values for:

```text
Category

Assigned User

Estimated Minutes

Frequency Days
```

---

## Default Category

Type:

```text
Dropdown
```

Options:

```text
HOUSEHOLD

FITNESS

FAMILY

HOME

PERSONAL

FINANCE
```

---

## Default Assigned User

Type:

```text
Dropdown
```

Options:

```text
STEFAN

JULIA
```

---

## Default Estimated Minutes

Type:

```text
Number
```

Range:

```text
1 - 480
```

Default:

```text
10
```

---

## Default Frequency

Type:

```text
Number
```

Range:

```text
1 - 3650
```

Default:

```text
14
```

---

# Dashboard Preferences

Allow configuration of:

```text
Show Upcoming Section

Show Category Summary

Show User Summary

Show Recent Activity
```

Type:

```text
Toggle Switch
```

Default:

```text
Enabled
```

---

# Application Preferences

## Timezone

Display current timezone.

Default:

```text
Europe/Berlin
```

Read-only for MVP.

Future versions may support editing.

---

## Theme

Type:

```text
Dropdown
```

Options:

```text
Light

Dark

System
```

Default:

```text
System
```

---

# Persistence

For MVP use:

```text
Local Storage
```

No backend API required.

---

# Settings Model

Create:

```typescript
UserPreferences
```

Example:

```typescript
{
  currentUser: "STEFAN",
  defaultCategory: "HOUSEHOLD",
  defaultAssignedTo: "STEFAN",
  defaultEstimatedMinutes: 10,
  defaultFrequencyDays: 14,
  showUpcoming: true,
  showCategorySummary: true,
  showUserSummary: true,
  showRecentActivity: true,
  theme: "SYSTEM"
}
```

---

# State Management

Create:

```text
Settings Context
```

Suggested:

```typescript
SettingsProvider
```

Responsibilities:

```text
Load Settings

Persist Settings

Provide Settings To Application
```

---

# Integration Requirements

Quick Add must consume:

```text
Default Category

Default User

Default Duration

Default Frequency
```

from preferences.

---

# Dashboard Integration

Dashboard widgets should honor:

```text
Show Upcoming

Show Category Summary

Show User Summary

Show Recent Activity
```

preferences.

---

# Theme Integration

Implement theme switching.

Support:

```text
Light

Dark

System
```

without page reload.

---

# Reset Settings

Provide:

```text
Reset To Defaults
```

Button.

Confirmation required.

Example:

```text
Reset all settings to default values?
```

Options:

```text
Reset

Cancel
```

---

# Export Settings

Create architecture hooks for future support.

Do not implement export functionality.

Prepare clean settings model.

---

# Responsive Design

Support:

```text
Desktop

Tablet

Mobile
```

Settings should remain usable on small screens.

---

# Accessibility

Requirements:

```text
Keyboard Navigation

Screen Reader Support

Accessible Form Labels

Accessible Switches
```

---

# Components

Create:

```text
features/settings/

├── SettingsPage
├── ProfileSettings
├── QuickAddSettings
├── DashboardSettings
├── ApplicationSettings
├── ThemeSelector
├── ResetSettingsDialog
└── SettingsProvider
```

---

# Hooks

Create:

```text
useSettings()

useTheme()

useCurrentUser()
```

---

# Testing Requirements

Create tests for:

```text
Settings Load

Settings Save

Current User Change

Quick Add Defaults Change

Theme Change

Dashboard Preference Change

Reset Preferences

Local Storage Persistence

Settings Provider

Responsive Layout
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
Settings Page

Settings Context

User Preferences Model

Theme Switching

Local Storage Persistence
```

Update:

```text
Dashboard

Quick Add

Application Layout

Navigation

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

- [x] Settings page implemented
- [ ] Current user configurable — intentionally not: superseded by the login (see Implementation Status)
- [x] Quick Add defaults configurable
- [x] Dashboard preferences configurable
- [x] Theme switching implemented
- [x] Local storage persistence works
- [x] Reset settings works
- [x] Responsive design works
- [x] Tests passing

---

# Definition of Done

- User preferences are configurable
- Hardcoded defaults removed from UI
- Dashboard honors preferences
- Quick Add honors preferences
- Theme support available
- Settings persist across sessions
- Feature deploys through GitHub Actions

---

# Out of Scope

Do not implement:

- Backend Settings API
- Multi-Household Support
- User Authentication
- Cloud Synchronization
- Notifications
- Analytics Settings

These capabilities will be implemented in future tickets.

---

# Implementation Status

Implemented 2026-10-05.

- `src/features/settings/`: `preferences.ts` (model, defaults, validation, versioned localStorage envelope),
  `SettingsProvider` (+ `useSettings`, `useThemePreference`), `useNewTennerDefaults`, `SettingsPage`,
  `SettingsSection`, `ProfileSettings`, `QuickAddSettings`, `DashboardSettings`, `ApplicationSettings`,
  `ThemeSelector`, `ResetSettingsDialog`. Route `/settings` replaces the placeholder.
- Theme: `createAppTheme("light" | "dark")`; `AppProviders` applies Hell/Dunkel/"wie das Gerät"
  (`prefers-color-scheme`) without reload.
- Integration: Quick Add (values and hint) and the create dialog use the defaults; the dashboard honours the four
  section switches and uses the full width without the side column.
- Tests: 18 new (model load/save/validation/blocked storage, provider, page sections, profile logout, Quick Add
  defaults, number range, dashboard switch, theme change and system theme, reset with confirm/cancel, full-width
  controls), plus dashboard and Quick Add integration. Frontend: lint, `format:check`, build, 226 tests.
- Browser check (Chromium, phone width): dark theme applies immediately and survives a reload.

Deviations (architecture wins over the ticket, CLAUDE.md):

- **Current user not configurable.** Since SECURITY-003/004 the person comes from the Google login and the
  backend enforces it; a dropdown would show a choice the server rejects. The profile shows the person read-only
  with "Abmelden". The default assignee for new Tenners can still be another member ("Ich selbst" default).
- `useCurrentUser()` already existed (login); the theme hook is `useThemePreference()` to avoid confusion with
  MUI's `useTheme()`.
- The model has no `currentUser`; it has `defaultAssignedTo: "SELF" | UserId` instead.
- Export is not implemented; the versioned envelope (`{ version, preferences }`) is the hook for it.
