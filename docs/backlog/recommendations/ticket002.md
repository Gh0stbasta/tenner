# REC-002: Rename the app to „Zentrale“ and Tenners to „Aufgaben“

## Goal

The household sees the app as **Zentrale** and the recurring tasks as **Aufgaben**. This applies to the web app,
the installed phone app, Alexa, the Echo Show widgets and notifications.

## Context

- **Who asked:** the owner (Erwachsener 1), 2026-10-08: „wir müssen das projekt und alle titel von tenner auf
  "Zentrale" ändern“.
- **Owner decisions (2026-10-08):**
  - The app name **and** the tasks are renamed: „Aufgaben“ instead of „Tenner“.
  - The Alexa invocation is „Familien Zentrale“. Amazon does not accept a single generic word like „Zentrale“.
- **Decision on technical names:** the repository, code identifiers, AWS resources, tables, API routes and the
  Alexa widget package IDs keep `tenner`. Renaming them would recreate tables and lose data, or orphan installed
  widgets.

## Requirements

- Web app:
  - Page title, PWA name and short name, app shortcut „Neue Aufgabe“, navigation „Aufgaben“.
  - All visible texts, error messages and push notifications („🏠 Zentrale“).
- German grammar: der Tenner → die Aufgabe; counts read „1 Aufgabe“ / „3 Aufgaben“.
- Alexa:
  - Skill name „Zentrale“, invocation „familien zentrale“, examples, speech („Willkommen in der Zentrale“, „eine
    Aufgabe“), card title.
  - Samples „welche aufgaben sind …“.
  - The post-deploy health check simulates „öffne familien zentrale“.
- Widgets:
  - The status widget is called „Zentrale“; the meal widget is called „Zentrale Essen“.
  - Package versions are raised so installed widgets update.
  - The preview image shows „Zentrale“.
- Notifications: daily digest, overdue alerts, Alexa reminder and notification texts.
- Documentation: a naming note in README, architecture and Alexa README; the invocation is updated in the current
  documents.

## Acceptance Criteria

- [x] No visible „Tenner“ left in web app, Alexa speech, widgets or notification texts (checked by scanning all
      string literals; only code identifiers remain)
- [x] Singular and plural correct for counts (tested)
- [x] Invocation name „familien zentrale“ (tested), health check updated
- [x] Tests passing (frontend, alexa, backend, scripts)
- [ ] „Alexa, öffne Familien Zentrale“ works on the Echo Show: owner check after the deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (TD-042)
- [x] Acceptance criteria verified (device check open)
- [x] Git commit created

## Assumptions

- „Zentrale“ is used with its article in sentences („Die Zentrale ist gerade nicht erreichbar“).
- The page address `/tenners` stays, so bookmarks keep working. Only its title changes.
- Older documents (tickets, ADRs, release 1.0) keep „Tenner“ as a historical name.

## Out of Scope

- These are owner steps outside the repository:
  - Google sign-in consent screen app name (Google Auth Platform → Branding).
  - Amazon developer console texts outside the skill package.
- Renaming the repository, AWS resources, domain or Cognito prefix.

---

# Implementation Status

Done (2026-10-08); the device check is open.

- Visible texts were rewritten in string literals only, with grammar rules and a final review of every changed text.
  The rewrite covered:
  - `frontend/src/`
  - `alexa/src/`
  - `backend/src/{notifications,push,alexa}`
  - the matching tests
- Count helpers: `formatTennerCount`, `tennerCount` (Alexa), `tenners` (notifications).
- Frontend: `frontend/index.html`, `public/manifest.json`, `public/push-sw.js`, and `public/alexa/widget-preview.png`
  re-rendered.
- Alexa:
  - `skill.json`, `interactionModels/custom/de-DE.json`.
  - Widget manifests: `tenner-status` 1.3.0, `meal-today` 1.1.0.
  - The status widget document.
- Health check: `scripts/alexa-health-check.sh`, `.github/workflows/deploy.yml`.
