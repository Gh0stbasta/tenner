# MAINT-023: „Alexa, sag Mary Poppins Übersicht“ opens the Tafel in the browser

## Goal

One voice command opens the Tafel (MAINT-022) on the Echo Show in the device's browser (Silk).

## Context

Owner request (2026-11-17): „ich will irgendwie n befehl für marry poppins übersicht haben, sodass sich dann silk mit
dem link zur cloudfrontdistribution automatisch öffnet“. A skill cannot start Silk directly; the APL command
`OpenURL` („Open a specified URL in a web browser or other application on the device“, APL standard commands) can,
when the device allows it (`environment.allowOpenURL`). The skill has had no screen views since MAINT-006 (owner:
widget only); this ticket adds one minimal view whose only job is to open the browser — an explicit owner request.
Alternatives checked: Alexa Web API for Games closes a web app after at most 300 seconds without interaction (HTML
interface reference), so it cannot serve a wall display.

## Requirements

- New intent `OverviewIntent`: „Übersicht“, „zeig die Übersicht“, „öffne die Übersicht“, „Tafel“, „zeig die Tafel“.
- On devices with APL: speech „Ich öffne die Übersicht.“ and a small APL document that runs `OpenURL` with
  `<web app URL>/tafel` on mount; if the device refuses, the document shows the address to open by hand.
- On devices without a screen: speech that the overview is for the Echo Show, plus a card with the link in the Alexa
  app.
- The web app URL comes from Terraform (CloudFront distribution) as the skill Lambda's `WEB_APP_URL`; without it the
  skill says the overview is not set up.
- The URL carries no secret; signing in happens in the browser (Cognito, as on any device).

## Acceptance Criteria

- [x] The intent answers with an APL document that opens `/tafel` via `OpenURL` (screen devices)
- [x] Fallback text on the screen when `OpenURL` is refused; card on voice-only devices
- [x] `WEB_APP_URL` set by Terraform and read by the skill
- [x] Tests passing (alexa, Terraform)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). `alexa/src/handlers/overview.ts`: `OverviewIntent` → APL `RenderDocument` (token `overview`) with
`onMount` `OpenURL` to `<WEB_APP_URL>/tafel` and an `onFail` that replaces the status text with the address; without
the APL interface a simple card; without `WEB_APP_URL` „noch nicht eingerichtet“. `loadConfig` reads `WEB_APP_URL`;
Terraform sets it on the skill Lambda from the CloudFront distribution (`terraform/alexa.tf`, asserted in
`tests/alexa.tftest.hcl`). Interaction model: `OverviewIntent` with seven samples. Tests: screen device (document,
OpenURL source, fallback text), voice-only card, not configured, config, model. Validation: alexa 171 tests, lint,
typecheck; Terraform fmt, validate, 82 tests. Owner check on the Echo Show 21: does `OpenURL` open Silk, does the page
stay? No new technical debt.

## Assumptions

- Whether the Echo Show 21 allows `OpenURL` is only known on the device; the fallback keeps the command useful.
- The page stays in Silk as long as the device keeps the browser open; that behaviour is the owner's check.

## Out of Scope

- Keeping the Echo Show from returning to its home screen (device setting).
- Passing the skill's account token to the page (no sign-in through the URL).
