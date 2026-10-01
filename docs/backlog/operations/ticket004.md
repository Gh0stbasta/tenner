# OPERATIONS-004: Implement Release Versioning and Fast Rollback

## Type

CI/CD / Operations

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Make every deployment identifiable and quickly reversible without a full pipeline run.

---

# Background

Rollback currently means reverting a commit and waiting for the pipeline.
Knowing which version is live is not possible from the UI or API.

---

# Dependencies

```text
TICKET-018
```

---

# Scope

## Versioning

- Version format: `<yyyy.mm.dd>-<short-sha>`.
- Injected into frontend build (shown in Settings → About) and Lambda environment.
- `GET /health` returns `version`.

## Lambda Rollback

- Publish Lambda versions on deploy and route API traffic via an alias `live`.
- Document a one-command rollback: point alias to previous version.

## Frontend Rollback

- Keep previous release under `releases/<version>/` in S3, or rely on S3 versioning;
  choose the simpler reliable option and document the procedure.

## Release Notes

GitHub release created automatically on main deployment with commit list.

---

# Deliverables

```text
Version injection
Lambda alias deployment
Rollback procedures (runbook)
Automatic GitHub release
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run build
```

Perform a test rollback in dev (TICKET-021) or document why not possible yet.

---

# Acceptance Criteria

- Live version visible in UI and API
- Lambda rollback possible in one command
- Frontend rollback documented and tested
- Releases recorded

---

# Definition of Done

- Bad releases can be reverted in minutes

---

# Out of Scope

- Canary or weighted deployments
