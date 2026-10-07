# MAINT-002: Deliver the Echo Show home-screen widget

## Goal

The Tenner widget (ALEXA-007) can be added to the Echo Show home screen and shows today's Tenners.

## Context

Owner report (2026-10-07, Echo Show 21): the widget is not offered. Cause (TD-036): the widget package in
`alexa/widgets/tenner-status/` used a provisional format, was not declared in `skill.json` and was never uploaded —
the deploy only ran `update-skill-manifest` and `set-interaction-model`, which do not upload widget packages. The
notifier already pushes the data (Data Store object `tenner/status`), but no widget was installed to show it.

## Requirements

- Widget package in Amazon's layout: `skill-package/dataStorePackages/tenner-status/` with `manifest.json`
  (`packageType APL_PACKAGE`, `installStateChanges INFORM`, de-DE metadata, `WIDGET_M`), `presentations/default.tpl`,
  `documents/document.json` (the existing APL document), `datasources/default.json`.
- `skill.json`: interfaces `ALEXA_DATASTORE_PACKAGEMANAGER` (package `tenner-status`), `ALEXA_DATA_STORE`,
  `ALEXA_EXTENSION` with `alexaext:datastore:10`.
- Deploy imports the whole skill package to the development stage (still never live, ALEXA-010).
- Skill handles `Alexa.DataStore.PackageManager.UsagesInstalled` (register the Alexa account, which triggers a widget
  push), `UsagesRemoved`, `UpdateRequest`, `InstallationError` (logged) — without speech.

## Acceptance Criteria

- [x] Package in Amazon's layout, declared in the skill manifest (tested)
- [x] Deploy uploads the widget package (skill package import, development stage only)
- [x] Installing the widget registers the account and triggers a push; failures stay quiet and are logged
- [x] Private-skill tests still pass (no submission, no live stage)
- [x] Tests passing (`cd alexa && npm run lint && npm run typecheck && npm test`, `python3 -m unittest discover -s scripts/tests`)
- [ ] Widget added on the Echo Show 21 shows today's Tenners — owner check after the deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified (device check open, see above)
- [x] Git commit created

## Assumptions

- The package format follows Amazon's widget sample (`alexa-samples/skill-sample-plant-care-widget`); the Amazon
  developer documentation was not reachable from the development environment.
- `ask deploy --target skill-metadata --ignore-hash` with generated `ask-resources.json` / `.ask/ask-states.json`
  (profile `__ENVIRONMENT_ASK_PROFILE__`) imports the package; flags and file format checked against ask-cli 2.30.7.
  Imports always go to the development stage.
- Only the medium size (`WIDGET_M`, as in Amazon's sample) is published; the document already adapts to the size.
- No icon or preview image: the sample uses hosted images; Tenner has none on a stable public URL yet. If Amazon
  requires them, the import error will say so.

## Out of Scope

- Widget design changes; small widget size; images.

---

# Implementation Status

Done (2026-10-07); the device check is open.

- Package moved to `alexa/skill-package/dataStorePackages/tenner-status/` (document unchanged); sample data for tests
  in `alexa/tests/widgetSample.json`.
- `alexa/skill-package/skill.json`: widget interfaces.
- `scripts/deploy-alexa-skill.sh`: skill package import instead of manifest + model updates; status wait and test
  enablement unchanged.
- `alexa/src/handlers/widget.ts`: `WidgetInstalledHandler`, `WidgetLifecycleHandler`; registered in `skill.ts`.
- Tests: `alexa/tests/widget.test.ts` (package layout, manifest declaration, install without session, quiet failures,
  lifecycle logs); `scripts/tests` (private skill).
- Docs: `alexa/README.md` (widget, how to add it), TD-036 narrowed.
