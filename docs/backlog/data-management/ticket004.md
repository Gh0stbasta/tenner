# DATA-004: Define Data Retention Policy

## Type

Architecture / Data

---

## Priority

Low

---

## Phase

V2

---

## Goal

Define how long each type of data is kept and implement automatic expiry where needed.

---

# Background

Completion history is append-only and grows indefinitely. Other data
(notification logs, link codes, idempotency keys, client errors) is transient.
No policy exists.

---

# Dependencies

```text
SECURITY-013
```

---

# Scope

## Policy

Document in `docs/data-retention.md`:

```text
Tenners                   until deleted (soft-deleted: hard delete after 1 year?)
Completion history        indefinitely (core value), unless member erasure (DATA-005)
Idempotency records       24 hours (TTL)
Notification log          90 days (TTL)
Link/verification codes   ≤ 24 hours (TTL)
Application logs          30 days
Audit logs                365 days
Archives (S3)             2 years
```

Decide on soft-deleted Tenner hard deletion; if decided, implement a scheduled purge
with dry-run reporting.

## Implementation

- Verify TTL attributes on all transient items.
- Verify log group retention values in Terraform.

---

# Deliverables

```text
Retention policy document
TTL / retention verification
Optional purge job
```

---

# Validation

```bash
terraform fmt -check

terraform validate

npm run test
```

---

# Acceptance Criteria

- Retention defined for all data types
- Transient data expires automatically
- Decision on soft-deleted Tenners documented

---

# Definition of Done

- Data is not kept longer than necessary

---

# Out of Scope

- Legal holds
