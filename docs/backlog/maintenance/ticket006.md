# MAINT-006: Alexa skill without Echo Show views

## Goal

The skill answers by voice only; the Echo Show shows Tenner only through its home-screen widget.

## Context

Owner report (2026-10-08): opening Tenner Board on the Echo Show 21 still shows a blue bar, two boxes and
„Überfällig“ without any text (the ALEXA-006 dashboard renders incomplete). The cause could not be reproduced
locally (no APL renderer outside the device). Owner decision: „ich brauche aber gar keine Oberfläche sondern nur das
Widget.“

## Requirements

- No `Alexa.Presentation.APL.RenderDocument` in any skill response; screen devices get the same speech, reprompt and
  card as voice-only devices.
- Remove the ALEXA-006 views (APL documents, datasource builders, touch completion, screen state) instead of
  keeping dead code.
- The tenner-status widget gets no tap action (nothing to open); package version 1.1.0 → 1.2.0 so installed
  widgets update.
- A tap event from an older widget version is answered quietly (empty answer, no skill error).
- Documentation and the open ticket FOOD-017 (which planned an APL card) reflect the decision.

## Acceptance Criteria

- [x] No skill response contains an APL view (tests: launch, questions, briefing, widget tap without session)
- [x] Widget document without `SendEvent`/`TouchWrapper`, version 1.2.0 (tested)
- [x] Old `openDashboard` tap without a session: empty answer, no error log (tested)
- [x] Alexa README, runbook and FOOD-017 updated
- [x] Tests passing (`cd alexa && npm run lint && npm run typecheck && npm test`)
- [ ] Opening Tenner Board on the Echo Show 21 shows no broken view — owner check after the deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented (none new; the removed views had no open debt items)
- [x] Acceptance criteria verified (device check open)
- [x] Git commit created

## Assumptions

- After a voice answer the Echo Show shows Alexa's default card/response screen; that is accepted („gar keine
  Oberfläche“ refers to Tenner's own views).
- The `ALEXA_PRESENTATION_APL` interface stays in `skill.json`: the widget package is an APL package.
- Installed widgets update to 1.2.0 automatically (`updateStateChanges INFORM`); if not, remove and add the widget.

## Out of Scope

- The meal widget (FOOD-018, own ticket).
- Fixing the ALEXA-006 rendering; it is in the Git history if views are ever wanted again.

---

# Implementation Status

Done (2026-10-08); the device check is open.

- Removed: `alexa/apl/` (dashboard.json, list.json), `alexa/src/apl.ts`, `alexa/src/handlers/screen.ts`,
  `alexa/src/handlers/touch.ts`, `OpenDashboardHandler`, tests `apl.test.ts` and `screen.test.ts`.
- Launch, today/overdue questions, briefing and completion no longer render; `answer()` no longer keeps a session
  open for a view.
- Widget `tenner-status` 1.2.0 without tap action.
- Tests: `alexa/tests/widget.test.ts`, `alexa/tests/system.test.ts`.
