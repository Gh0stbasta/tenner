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

- Smoke tests run after every deployment
- Failures fail the pipeline
- No data modified by smoke tests

---

# Definition of Done

- Broken deployments are detected immediately

---

# Out of Scope

- Full end-to-end UI tests
