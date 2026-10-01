# SECURITY-009: Add Infrastructure-as-Code Security Scanning

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

Detect insecure Terraform configurations before they are deployed.

---

# Background

All infrastructure is Terraform-managed. Misconfigurations (public buckets,
missing encryption, wildcard IAM) should be caught in pull requests.

---

# Dependencies

```text
TICKET-001
TICKET-002
```

---

# Scope

- Add `checkov` or `trivy config` to the PR workflow (choose one, justify).
- Fail on HIGH/CRITICAL findings.
- Suppressions only inline with justification comment and ticket reference.
- Upload results as SARIF to GitHub code scanning if available.

---

# Deliverables

```text
IaC scanning step
Suppression policy documentation
Initial findings fixed or documented
```

---

# Validation

- PR workflow passes.
- Scanner demonstrably fails on an intentionally insecure test fixture (not committed to main).

---

# Acceptance Criteria

- IaC scanner runs on every PR
- High/critical findings block merge
- Existing findings resolved or justified

---

# Definition of Done

- Insecure infrastructure changes are caught automatically

---

# Out of Scope

- Runtime cloud posture management
