# MOBILE-001: Make Tenner an Installable Progressive Web App

## Type

Frontend Feature

---

## Priority

High

---

## Phase

V2

---

## Goal

Allow users to install Tenner on their phone's home screen and launch it like a native app.

---

# Background

Tenner is mostly used on phones for quick completions. A native app (React Native)
is listed as a future idea; a PWA delivers most of the benefit at a fraction of the cost.

---

# Dependencies

```text
FRONTEND-001
TICKET-017
```

---

# Scope

## Web App Manifest

```text
name: Tenner
short_name: Tenner
display: standalone
start_url: /dashboard
theme_color / background_color aligned with MUI theme
icons: 192, 512, maskable variants
shortcuts: "Quick Add", "Today"
```

## iOS Support

Apple touch icons, `apple-mobile-web-app-capable`, status bar style.

## Install Prompt

- Use `beforeinstallprompt` (Android/desktop) for an unobtrusive "Install app" entry in Settings.
- iOS: show instructions ("Share → Add to Home Screen") in Settings.

## Tooling

Use `vite-plugin-pwa` (justify dependency) for manifest and service worker generation.

---

# Testing Requirements

```text
Manifest Valid (Lighthouse PWA checks)
Install Entry Visibility
iOS Instructions
```

---

# Deliverables

```text
Manifest and icons
Install UI
Documentation
```

---

# Validation

```bash
npm run lint

npm run build

npm run test
```

Lighthouse "installable" check passes on the deployed site.

---

# Acceptance Criteria

- Tenner installable on Android, iOS and desktop
- Launches in standalone mode
- App shortcuts available
- Tests passing

---

# Definition of Done

- Tenner feels like an app on the home screen

---

# Out of Scope

- Offline support (MOBILE-002, 003, 004)
- Push (MOBILE-006)
