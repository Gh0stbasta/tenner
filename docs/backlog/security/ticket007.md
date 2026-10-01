# SECURITY-007: Implement Dependency Scanning

## Type

CI/CD / Security

---

## Priority

High

---

## Phase

MVP

---

## Goal

Detect known vulnerabilities in npm dependencies and GitHub Actions automatically,
and keep dependencies up to date.

---

# Background

The frontend and backend depend on npm packages; Terraform on providers;
workflows on third-party actions. Vulnerabilities are currently not tracked.

---

# Dependencies

```text
TICKET-001
```

---

# Scope

## Dependabot

Create `.github/dependabot.yml` for:

```text
npm (frontend)       weekly, grouped minor/patch
npm (backend)        weekly, grouped minor/patch
github-actions       weekly
terraform            monthly
```

Limit open PRs to keep review effort low.

## CI Audit

Add to PR workflow:

```bash
npm audit --audit-level=high --omit=dev
```

for frontend and backend. High/critical vulnerabilities in production dependencies
fail the build. Documented, time-boxed exceptions are allowed via an allowlist file.

## Dependabot Security Alerts

Document that repository settings must enable Dependabot alerts
(repository setting, outside this repository's files).

---

# Deliverables

```text
.github/dependabot.yml
npm audit CI steps
Exception allowlist file and process
README / docs/security.md update
```

---

# Validation

- PR workflow runs and passes on a clean dependency tree.
- Audit step demonstrably fails on a known vulnerable version (verified in a throwaway branch).

---

# Acceptance Criteria

- Dependabot configured for all ecosystems
- CI fails on high/critical production vulnerabilities
- Exception process documented

---

# Definition of Done

- Vulnerable dependencies are detected before deployment

---

# Out of Scope

- Supply-chain hardening (SECURITY-008)
- Container scanning (no containers in architecture)
