# DATA-003: Implement Scheduled Data Archive to S3

## Type

Infrastructure

---

## Priority

Low

---

## Phase

V2

---

## Goal

Keep periodic, long-term snapshots of Tenner data in S3, independent of the
35-day PITR window.

---

# Background

PITR covers 35 days. Logical corruption noticed later (e.g. a buggy migration months ago)
cannot be repaired with PITR alone.

---

# Dependencies

```text
OPERATIONS-003
TICKET-006
```

---

# Scope

## Option Selection (document decision)

```text
A. DynamoDB native export to S3 (requires PITR; cost per GB exported, minimal for small tables)
B. Scheduled Lambda writing the DATA-001 JSON export to S3
```

Option B produces a human-readable, re-importable snapshot and reuses existing code.
Option A is more robust for large tables. Prefer B for current size.

## Implementation

- EventBridge schedule: weekly.
- Private, encrypted, versioned S3 bucket `tenner-archive-<env>` with Block Public Access.
- Lifecycle: transition to Glacier Instant Retrieval after 30 days, delete after 2 years.
- Object Lock not required (document).

---

# Deliverables

```text
Archive bucket (Terraform)
Scheduled archive job
Restore-from-archive instructions (DATA-002 import)
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- Weekly snapshots stored
- Bucket private, encrypted, with lifecycle
- Restore procedure documented

---

# Definition of Done

- Long-term recovery is possible beyond PITR

---

# Out of Scope

- Cross-region replication
