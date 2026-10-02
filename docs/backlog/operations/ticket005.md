# OPERATIONS-005: Detect Terraform Drift

## Type

CI/CD / Operations

---

## Priority

Low

---

## Phase

V2

---

## Goal

Detect manual changes in AWS that diverge from Terraform, enforcing
"Terraform is the single source of truth".

---

# Background

The architecture forbids manual changes. There is no control that detects them.

---

# Dependencies

```text
TICKET-001
TICKET-003
```

---

# Scope

- Scheduled GitHub Actions workflow (weekly) running `terraform plan -detailed-exitcode`.
- Read-only IAM role for drift detection (separate from deploy role, plan-only permissions).
- If drift is detected (exit code 2), open or update a GitHub issue with the plan summary
  (no sensitive values).

---

# Deliverables

```text
Drift detection workflow
Read-only role definition or documented requirement
Issue reporting
```

---

# Validation

- Workflow runs successfully with no drift.
- Introduce harmless drift in dev (e.g. tag change) and confirm detection.

---

# Acceptance Criteria

- Weekly drift detection runs
- Drift creates a visible issue
- Uses read-only permissions

---

# Definition of Done

- Manual changes are discovered within a week

---

# Out of Scope

- Automatic drift remediation
