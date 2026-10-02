# OPERATIONS-002: Write Operational Runbooks

## Type

Documentation / Operations

---

## Priority

Medium

---

## Phase

V2

---

## Goal

Document step-by-step procedures for the most likely operational incidents so
that problems can be solved quickly — also by Claude working from the repository.

---

# Background

CLAUDE.md requires rollback guidance and operability. There are no runbooks.

---

# Dependencies

```text
OBSERVABILITY-002
TICKET-018
```

---

# Scope

Create `docs/runbooks/` with:

```text
api-5xx-errors.md
lambda-errors-or-throttles.md
dynamodb-throttling-or-errors.md
failed-deployment-and-rollback.md
terraform-state-lock-stuck.md
restore-dynamodb-from-pitr.md
notification-delivery-failures.md
leaked-secret.md
cost-alert.md
user-locked-out.md
```

Each runbook:

```text
Symptoms / triggering alarm
Impact
Diagnosis steps (with Logs Insights queries)
Mitigation
Rollback
Verification
Escalation / follow-up
```

All commands use placeholders; no account IDs or secrets.

---

# Deliverables

```text
Runbook directory and documents
Links from alarm descriptions (OBSERVABILITY-002)
README section "Operations"
```

---

# Validation

Dry-run review: walk through each runbook against the current system.

---

# Acceptance Criteria

- Runbooks exist for all listed scenarios
- Each follows the template
- Alarms link to runbooks

---

# Definition of Done

- Incidents can be handled following documented steps

---

# Out of Scope

- Incident management tooling
