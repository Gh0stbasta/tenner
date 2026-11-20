# MAINT-026: Alexa invocation name „Butler Bruno“

## Goal

The household skill is called with „Butler Bruno“ instead of „Zimmer Service“, so both Echo devices find it reliably.

## Context

Owner report (2026-11-20): after MAINT-025, „Zimmer Service“ does not work reliably on the Echo Show 21 (Alexa+), and
now not on the Echo Dot either, where „Mary Poppins“ had worked. „Zimmerservice“ is a common German word and a
built-in feature of Amazon's hotel offering (Alexa Smart Properties for Hospitality), so Alexa likely routes it to its
own features instead of the skill. Owner decision (2026-11-20): a new invented name rather than going back to „Mary
Poppins“; chosen „Butler Bruno“ (hotel style, alliteration, no product, film or Alexa feature of that name).

## Requirements

- Invocation name `butler bruno` in `skill-package/interactionModels/custom/de-DE.json`; example phrases in
  `skill.json` updated.
- Texts that tell people what to say (backend digest reminder, health check, code comments, living docs, unreleased
  CHANGELOG entries) use „Butler Bruno“.
- The skill's display name „Zentrale“ and its answers stay.
- The post-deploy health check simulates „öffne butler bruno“.

## Acceptance Criteria

- [x] The interaction model and the manifest use „butler bruno“ / „Butler Bruno“
- [x] No current code, script, workflow or living doc still tells people to say „Zimmer Service“
- [x] Tests passing (alexa, backend alexa channel, scripts)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-20). Invocation name `butler bruno` in the interaction model; example phrases in `skill.json`; the
backend's spoken digest reminder says „Alexa, sag Butler Bruno, starte meinen Tag“; the health check simulates
„öffne butler bruno“; code comments, alexa README, runbook, README, architecture and the unreleased CHANGELOG entries
updated. Display name and answers („Zentrale“) unchanged. Validation: alexa 172 tests, lint and typecheck; backend
alexa-channel tests (10); script tests. Takes effect with the next deploy (development stage). No new technical debt.

## Assumptions

- The cause for „Zimmer Service“ (collision with Amazon's built-in hotel feature) is likely but not confirmed; the
  owner did not check the voice history before the rename.
- An invented two-word name with a person's first name is allowed for a development skill that is never published
  (ALEXA-010).
- If „Butler Bruno“ also fails on the Echo Show 21 only, the fallback is routines with fixed trigger phrases or
  turning off Alexa+ on that device, not another rename.
- Routines the owner created with the old name must be changed by the owner in the Alexa app.
- Closed tickets (MAINT-017, MAINT-025) keep the old names as history.

## Out of Scope

- Renaming the skill's display name „Zentrale“.
- Alexa+-specific integration (Alexa+ add-ons).
