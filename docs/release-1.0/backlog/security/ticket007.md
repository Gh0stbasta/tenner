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

- [x] Dependabot configured for all ecosystems
- [x] CI fails on high/critical production vulnerabilities
- [x] Exception process documented

---

# Definition of Done

- Vulnerable dependencies are detected before deployment

---

# Out of Scope

- Supply-chain hardening (SECURITY-008)
- Container scanning (no containers in architecture)

---

# Implementation Status

Implemented 2026-10-05.

- `.github/dependabot.yml`: npm (frontend, backend; weekly, minor/patch grouped, max 3 PRs), GitHub Actions
  (weekly, grouped, max 2), Terraform (monthly, max 1).
- `scripts/check_npm_audit.py` evaluates `npm audit --omit=dev --json`: high/critical advisories fail unless
  listed in `.github/npm-audit-allowlist.json` with reason and expiry; expired entries fail; unused ones are
  reported. Runs in the PR validation and in the deploy build gate for frontend and backend.
- Tests: `scripts/tests/test_check_npm_audit.py` (12 tests; 27 script tests in total), `actionlint`.
- Validation: a throwaway project with `lodash@4.17.11` fails the check (4 high/critical advisories, exit 1);
  frontend and backend pass (0 vulnerabilities on 2026-10-05).
- Docs: README "Dependency Scanning" (process, example, repository settings).

Deviation: no separate `docs/security.md`; the process is in the README next to the other operations topics.
Manual follow-up: enable Dependabot alerts and security updates in the repository settings.
