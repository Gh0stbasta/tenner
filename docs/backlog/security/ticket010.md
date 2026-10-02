# SECURITY-010: Add Static Code Analysis and Secret Scanning

## Type

CI/CD / Security

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Detect insecure code patterns and accidentally committed secrets automatically.

---

# Background

CLAUDE.md requires that secrets are never committed. There is no automated control
that enforces this.

---

# Dependencies

```text
TICKET-001
```

---

# Scope

## Static Analysis

- Enable CodeQL for JavaScript/TypeScript (GitHub Actions workflow).
- Add `eslint-plugin-security` or equivalent rules where they add value without noise.

## Secret Scanning

- Add `gitleaks` to the PR workflow (scan diff).
- Document enabling GitHub secret scanning and push protection in repository settings.
- Provide `.gitleaks.toml` with allowlist for documentation placeholders.

## Response Process

Document what to do if a secret is detected:

```text
1. Revoke/rotate the secret immediately
2. Remove from code
3. Assess exposure (history rewriting only with explicit approval)
```

---

# Deliverables

```text
CodeQL workflow
gitleaks step and config
docs/security.md incident response for leaked secrets
```

---

# Validation

- Workflows pass on the current code base.
- gitleaks detects a dummy secret in a throwaway branch.

---

# Acceptance Criteria

- CodeQL runs on PRs and main
- Secret scanning blocks PRs with secrets
- Response process documented

---

# Definition of Done

- Code-level vulnerabilities and leaked secrets are detected early

---

# Out of Scope

- Dynamic application security testing (DAST)
- Penetration testing
