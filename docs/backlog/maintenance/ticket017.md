# MAINT-017: Alexa invocation name „Mary Poppins“

## Goal

The household skill is called with „Mary Poppins“ instead of „Familien Zentrale“, so Alexa no longer confuses it with
the public skill „Familienkalender“.

## Context

Owner report (2026-11-17): the Echo Dot starts the public skill „Familienkalender“ when asked for „Familien Zentrale“.
Alexa hears „Familienzentrale“, finds no skill of that name and picks the closest public one; a development skill has
no priority. Owner decision (2026-11-17): „dann machen wir mal marry poppins draus bitte“ (the household help's
nickname; the real name stays out of the repository). The deploy uploads the interaction model to the development
stage (ALEXA-010), so the console follows without a manual import.

## Requirements

- Invocation name `mary poppins` in `skill-package/interactionModels/custom/de-DE.json`; example phrases in
  `skill.json` updated.
- Texts that tell people what to say (Alexa digest reminder in the backend, health check, docs) use „Mary Poppins“.
- The skill's display name „Zentrale“ and its answers („Willkommen in der Zentrale“) stay.
- The post-deploy health check simulates „öffne mary poppins“.

## Acceptance Criteria

- [x] The interaction model and the manifest use „mary poppins“ / „Mary Poppins“
- [x] No current code, script, workflow or living doc still tells people to say „Familien Zentrale“
- [x] Tests passing (alexa, backend)

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified
- [x] Git commit created

## Implementation Status

Done (2026-11-17). Invocation name `mary poppins` in the interaction model; example phrases in `skill.json`; the
backend's spoken digest reminder (`src/alexa/alexa-channel.ts`) says „Alexa, sag Mary Poppins, starte meinen Tag“;
the health check simulates „öffne mary poppins“ (`scripts/alexa-health-check.sh`, deploy workflow comment); code
comments, alexa README, runbook, README and architecture updated. Display name and answers („Zentrale“) unchanged, so
the health check still looks for „Zentrale“. Validation: alexa 160 tests, backend alexa-channel tests, script tests
(48), lint and typecheck. Takes effect with the next deploy (development stage). No new technical debt.

## Assumptions

- A development skill may use a well-known character name; it is never published (ALEXA-010), so Amazon's
  certification rules on third-party names do not apply.
- „Alexa, öffne Mary Poppins“ could start music or audio books of the same name on some devices; „sag/frag Mary
  Poppins, …“ should reach the skill. The owner tests on the Echo; renaming again is a one-line change.
- Closed tickets and release notes keep the old name as history.

## Out of Scope

- New shopping phrases (MAINT-018).
- Renaming the skill's display name „Zentrale“.
