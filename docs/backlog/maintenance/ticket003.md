# MAINT-003: Widget icon and preview for the skill package import

## Goal

The deploy imports the skill package with the Echo Show widget (MAINT-002) without errors.

## Context

The deploy of PR #34 (run 33, 2026-10-07) failed at „Deploy Alexa skill package“. Terraform, the web app and the
smoke tests were deployed (so MAINT-001 is live); the skill package import was rejected:

```text
$.publishingInformation.locales.de-DE[0].metadata.iconUri: is missing but it is required
$.publishingInformation.locales.de-DE[0].metadata.previews: is missing but it is required
InteractionModel.de-DE FAILED · Manifest ROLLBACK_FAILED
```

MAINT-002 had named this risk (no image on a stable public URL).

## Requirements

- The widget package manifest has `iconUri` and `previews` on public HTTPS URLs.
- No CloudFront domain in the repository: the manifest uses `${WEB_APP_URL}`, the deploy fills in the web app URL
  (Terraform output `frontend_url`); the images are part of the web app (`frontend/public`), which is published
  before the skill step.
- The render step fails early when an entry has no icon or preview or an image is not on the web app.

## Acceptance Criteria

- [x] Icon (`/icons/icon-512.png`, the app icon) and preview (`/alexa/widget-preview.png`) in the package manifest
- [x] Deploy renders the URLs from `frontend_url`; the files exist in `frontend/public` (tested)
- [x] Tests passing (`python3 -m unittest discover -s scripts/tests`, `cd alexa && npm test`, frontend build)
- [ ] Deploy run green after the merge — verified with the next deploy

## Definition of Done

- [x] Implementation completed
- [x] Tests completed
- [x] Documentation updated
- [x] Technical debt documented
- [x] Acceptance criteria verified (deploy run after the merge open)
- [x] Git commit created

## Assumptions

- Image sizes are not checked by Amazon at import (the sample uses arbitrary images); the preview is 800 × 600 PNG,
  rendered from an HTML mock-up of the widget with neutral example names.
- `Manifest ROLLBACK_FAILED` is fixed by the next successful import, which replaces the whole development stage
  package; the live stage does not exist (ALEXA-010).

## Out of Scope

- A designed icon or real screenshots of the widget.

---

# Implementation Status

Done (2026-10-07); the green deploy is open.

- `alexa/skill-package/dataStorePackages/tenner-status/manifest.json`: `iconUri`, `previews` with `${WEB_APP_URL}`.
- `frontend/public/alexa/widget-preview.png`.
- `scripts/render_alexa_widget.py` (+ `scripts/tests/test_render_alexa_widget.py`); `scripts/deploy-alexa-skill.sh`
  takes the web app URL as fourth argument; `.github/workflows/deploy.yml` passes `frontend_url`.
