# MAINT-025: Alexa invocation name „Zimmer Service“

## Goal

The household skill is called with „Zimmer Service“ instead of „Mary Poppins“, so it is found on the Echo Show 21
with Alexa+ as well.

## Context

Owner report (2026-11-17): the Echo Dot runs the skill with „Mary Poppins“, the Echo Show 21 answers „konnte Mary
Poppins nicht finden“. The owner confirmed that Alexa+ is active on the Echo Show 21 and asked for a different name.
A likely cause is that Alexa+ takes the well-known film title as a request about the film or character instead of the
skill name. Owner decision (2026-11-17): a name in the hotel or concierge style; chosen „Zimmer Service“ from the
proposals (plain German words that the German speech recognition hears reliably, unlike „Concierge“).

## Requirements

- Invocation name `zimmer service` in `skill-package/interactionModels/custom/de-DE.json`; example phrases in
  `skill.json` updated.
- Texts that tell people what to say (backend digest reminder, health check, code comments, living docs) use
  „Zimmer Service“.
- The skill's display name „Zentrale“ and its answers stay.
- The post-deploy health check simulates „öffne zimmer service“.

## Acceptance Criteria

- [x] The interaction model and the manifest use „zimmer service“ / „Zimmer Service“
- [x] No current code, script, workflow or living doc still tells people to say „Mary Poppins“
- [x] Tests passing (alexa, backend alexa channel, scripts)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). Invocation name `zimmer service` in the interaction model; example phrases in `skill.json`; the
backend's spoken digest reminder says „Alexa, sag Zimmer Service, starte meinen Tag“; the health check simulates
„öffne zimmer service“ (`scripts/alexa-health-check.sh`, deploy workflow comment); code comments, alexa README,
runbook, README, architecture and the unreleased CHANGELOG entries updated. Display name and answers („Zentrale“)
unchanged, so the health check still looks for „Zentrale“. Validation: alexa 172 tests, lint and typecheck; backend
alexa-channel tests (10); script tests. Takes effect with the next deploy (development stage). No new technical debt.

## Assumptions

- Alexa+ resolves a plain two-word German name better than a famous title; this is not documented by Amazon and is
  checked by the owner on the Echo Show 21. If it still fails there, the next step is to look at Alexa+'s own handling
  of classic skills, not another rename.
- Routines the owner created with „sag Mary Poppins …“ (for example „Einkauf“, „starte meinen Tag“) must be changed by
  the owner in the Alexa app.
- Closed tickets, the technical-debt record of the owner test and release history keep the old name.

## Out of Scope

- Renaming the skill's display name „Zentrale“.
- Alexa+-specific integration (Alexa+ add-ons).
