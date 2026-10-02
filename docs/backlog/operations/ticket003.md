# OPERATIONS-003: Validate Backup and Restore

## Type

Operations

---

## Priority

High

---

## Phase

V2

---

## Goal

Prove that Tenner data can actually be restored, and document recovery objectives.

---

# Background

Point-in-time recovery and deletion protection are enabled on DynamoDB tables
(TICKET-006). A backup that has never been restored is not a verified backup.

---

# Dependencies

```text
TICKET-006
```

---

# Scope

## Recovery Objectives

Document:

```text
RPO: ≤ 5 minutes (PITR)
RTO: ≤ 2 hours (manual restore)
```

## Restore Drill

1. Restore `tenner-tenners` and `tenner-history` via PITR into new tables
   (`tenner-tenners-restore-<date>`).
2. Verify item counts and sample records against production.
3. Document how the application would be switched to restored tables
   (Terraform variable for table names or data copy back).
4. Delete restored tables afterwards (explicit approval required).

## Automation

Provide a script (`scripts/restore-drill.sh`) that performs steps 1–2 with
`--dry-run` default.

## Schedule

Repeat the drill every 6 months; record the results in `docs/runbooks/restore-log.md`.

---

# Safety

The drill must never modify production tables. Restores always target new table names.

---

# Deliverables

```text
Recovery objectives documentation
Restore drill script
First drill report
```

---

# Validation

Successful drill with documented results.

---

# Acceptance Criteria

- RPO/RTO documented
- Restore performed successfully into separate tables
- Data verified
- Script and procedure documented

---

# Definition of Done

- Data recovery is proven, not assumed

---

# Out of Scope

- Cross-region backups
- Scheduled exports (DATA-003)
