# MAINT-005: Widget tap rejected by Alexa (interaction mode)

## Goal

Tapping the Tenner widget on the Echo Show opens the skill with the dashboard.

## Context

Owner report (2026-10-08): the widget still does not work. The skill log (`docs/errors/alexaskill.md`, 06:53 – 07:05
UTC) shows, for every tap:

```text
Alexa.Presentation.APL.UserEvent   apiCalls 3, outcome ANSWERED   (the skill answers with speech + dashboard)
System.ExceptionEncountered        (right after: Alexa rejected that response)
```

MAINT-004 works (no more `skill_error`, no alarm). Cause of the rejection: the widget's `SendEvent` had no
`flags.interactionMode`. A widget event without it is handled as `INLINE` (in the background), where the skill must
not speak, show a view or open a session. Amazon's widget sample opens its skill with
`"flags": {"interactionMode": "STANDARD"}`.

## Requirements

- The widget's tap sends `SendEvent ["openDashboard"]` with `interactionMode STANDARD`.
- Package version raised (1.0.0 → 1.1.0) so installed widgets receive the update.
- `System.ExceptionEncountered` is logged with Alexa's error type and message, so a rejected response is visible.

## Acceptance Criteria

- [x] Widget document sends the tap in STANDARD mode (tested)
- [x] Package version 1.1.0
- [x] `System.ExceptionEncountered` logged as `system_exception` with type and message (tested)
- [x] Tests passing (`cd alexa && npm run lint && npm run typecheck && npm test`, `python3 -m unittest discover -s scripts/tests`)
- [ ] Tap on the widget opens the dashboard on the Echo Show 21 — owner check after the deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified (device check open)
- [x] Git commit created

## Assumptions

- The exception's details were not in the log (the skill did not log them yet); the cause is derived from the
  pattern and Amazon's sample. The new `system_exception` line confirms or corrects it on the next tap.
- Installed widgets update to 1.1.0 automatically (`updateStateChanges INFORM`); if not, remove and add the widget.

## Out of Scope

- Touch completion inside the widget (`INLINE` events); the widget only opens the skill.

---

# Implementation Status

Done (2026-10-08); the device check is open.

- `alexa/skill-package/dataStorePackages/tenner-status/documents/document.json`: `flags.interactionMode STANDARD`;
  `manifest.json` version 1.1.0.
- `alexa/src/handlers/system.ts`: `SystemExceptionHandler`; wired in `alexa/src/skill.ts`.
- Tests: `alexa/tests/widget.test.ts`, `alexa/tests/system.test.ts`.
