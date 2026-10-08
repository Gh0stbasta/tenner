# MAINT-004: Widget system messages counted as skill errors

## Goal

Loading or using the Echo Show widget no longer sets off `tenner-alexa-skill-error-rate`.

## Context

Owner report (2026-10-08): the widget can be added on the Echo Show 21, but loading it triggers the alarm
`tenner-alexa-skill-error-rate`. Analysis:

- Amazon sends system messages for widgets that are not spoken requests and often have no session, e.g.
  `Alexa.Presentation.APL.RuntimeError` (an APL document failed on the device) or `Alexa.DataStore.Error` (data could
  not be delivered).
- The skill had no handler for them. Worse, several intent handlers read session attributes in `canHandle`, which the
  ASK SDK refuses for requests without a session (`Cannot get SessionAttributes from out of session request!`). Every
  such message ended in the generic error handler: `skill_error`, outcome `ERROR`, counted in the error rate.
- A widget tap (`openDashboard`) runs the launch flow, which keeps state in session attributes; without a session it
  would fail the same way.

## Requirements

- Handle `Alexa.Presentation.APL.RuntimeError` (log type, reason, shortened message) and `Alexa.DataStore.Error`
  (log the error type only — its content echoes household data); no speech.
- Every other non-intent request type except `SessionEndedRequest` is logged as `unhandled_request` and answered
  quietly, before the intent handlers; unknown intents still take the error path.
- A widget tap without a session gets an empty new session, so the dashboard opens.

## Acceptance Criteria

- [x] APL runtime errors and Data Store errors are logged, not counted as skill errors
- [x] Other system messages without a session no longer reach session-reading handlers
- [x] A widget tap without a session opens the dashboard
- [x] Unknown intents still end in the error handler
- [x] Tests passing (`cd alexa && npm run lint && npm run typecheck && npm test`)
- [ ] Alarm stays quiet when the widget loads — owner check after the deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified (device check open)
- [x] Git commit created

## Assumptions

- Which message the Echo Show 21 sends was not visible (no log line yet); the fix covers the documented widget
  messages and any other system message. After the deploy, `apl_runtime_error`, `datastore_error` or
  `unhandled_request` in the skill log shows what the widget sends — an `apl_runtime_error` would point to a fix in
  the widget document.
- Behaviour change: unknown non-intent request types used to get a spoken error; they are now logged quietly.

## Out of Scope

- Changes to the widget document (only if the new logs show an APL runtime error).

---

# Implementation Status

Done (2026-10-08); the device check is open.

- `alexa/src/handlers/system.ts`: `AplRuntimeErrorHandler`, `DataStoreErrorHandler`, `UnknownSystemRequestHandler`
  (before the intent handlers), `touchSessionInterceptor`; wired in `alexa/src/skill.ts`.
- Tests: `alexa/tests/system.test.ts`; `alexa/tests/skill.test.ts` (unknown request types).
- Docs: `docs/runbooks/alexa.md`, `alexa/README.md`.
