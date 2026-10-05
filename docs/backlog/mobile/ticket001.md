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

---

# Implementation Status

Implemented 2026-10-05.

- [x] Installable on Android, iOS and desktop: `public/manifest.json` (name, `start_url` `/dashboard`, `scope` `/`,
  `display: standalone`, theme colors, icons 192/512 + maskable 512), Apple touch icon and iOS meta tags in
  `index.html`; Chromium reports no installability errors (DevTools `Page.getInstallabilityErrors` on the built app)
- [x] Launches in standalone mode (`display: standalone`, `apple-mobile-web-app-capable`)
- [x] App shortcuts: "Neuer Tenner" (`/dashboard?quickAdd=1` focuses Quick Add) and "Heute"
- [x] Install entry in Settings → "App": button for the browser prompt, iOS instructions, "installed" confirmation;
  hidden where installation is impossible
- [x] Tests passing: frontend 330 (manifest fields and icons, install entry visibility, prompt flow, iOS
  instructions, platform detection, shortcut focus); lint and build clean
- [ ] Lighthouse/installability check on the deployed site and a real install on Android and iPhone: after merge

Decisions and assumptions:

- **No `vite-plugin-pwa` in this ticket:** installation needs only a static manifest and icons, so no dependency is
  added here. The plugin is evaluated in MOBILE-002, where a service worker is needed.
- `manifest.json` instead of `.webmanifest` so S3 serves it as `application/json` without extra configuration; the
  deploy script uploads it with `no-cache` like `index.html`.
- The CSP (`default-src 'self'`) already allows the same-origin manifest and icons; no infrastructure change.
- The browser's own mini-infobar is suppressed in favor of the settings entry (unobtrusive, as the ticket asks).
