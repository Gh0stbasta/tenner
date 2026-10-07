# OPERATIONS-006: Implement Post-Deployment Smoke Tests

## Type

CI/CD / Operations

---

## Priority

High

---

## Phase

MVP

---

## Goal

Verify after every deployment that the live system works, and fail the pipeline
visibly if it does not.

---

# Background

The pipeline currently ends after Terraform Apply and frontend upload.
A successful apply does not guarantee a working application.

---

# Dependencies

```text
TICKET-018
```

---

# Scope

After deployment run:

```text
GET  <frontend>/                → 200, contains app root element
GET  <frontend>/dashboard       → 200 (SPA routing)
GET  <api>/health               → 200, version matches deployed version (OPERATIONS-004 when available)
GET  <api>/dashboard            → 200 or 401 (when auth enabled)
```

When authentication exists, use a dedicated smoke-test user whose credentials are
stored per SECURITY-006 / GitHub environment secrets, with read-only behavior.
Smoke tests must never create or modify household data.

Failure marks the workflow as failed and links the rollback runbook.

---

# Deliverables

```text
Smoke test script (scripts/smoke-test.sh or Node script)
Workflow step
Documentation
```

---

# Validation

Successful run against the deployed environment; intentionally failing URL
demonstrates failure handling.

---

# Acceptance Criteria

- [x] Smoke tests run after every deployment
- [x] Failures fail the pipeline
- [x] No data modified by smoke tests

---

# Definition of Done

- Broken deployments are detected immediately

---

# Out of Scope

- Full end-to-end UI tests

---

# Implementation Status

Implemented 2026-10-05.

- `scripts/smoke-test.sh <frontend-url> <api-endpoint>`: GET only. Frontend `/` (200, root element, CSP header),
  `/dashboard` (200, SPA routing), API `/health` (200, ok, database connected), `/dashboard` and `/onboarding`
  without token (401). Retries transient failures only; prints GitHub error annotations and the rollback pointer.
- `deploy.yml`: step "Smoke tests" after the frontend publish (outputs `frontend_url`, `api_endpoint`).
- Validation: `shellcheck`, `actionlint`; against a local stub: healthy → exit 0; broken (no CSP, 503 health,
  unprotected API) → 4 failures, exit 1; unreachable host → 5 failures, exit 1.
- Docs: README "Smoke Tests", TD-024.

Deviations:

- No authenticated checks: sign-in is Google only, so there is no non-interactive smoke-test user (TD-024). The
  401 checks replace "200 or 401" and cover the open live check of SECURITY-002.
- `/health` has no version field yet (OPERATIONS-004).
- The run against the deployed environment happens on the next merge to `main`.
